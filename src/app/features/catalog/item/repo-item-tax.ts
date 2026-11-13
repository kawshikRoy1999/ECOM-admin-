import { Component, OnInit, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { TaxesService } from '../../settings/taxes/taxes.service';
import { ItemService } from './item.service';
import { RepoTaxChange, TaxOption } from './item.models';

/** One editable component of a new tax slab (labelled with the company's own component names). */
interface SlabComponent {
  /** 1–5: which TaxNPercentage field it fills. */
  slot: number;
  label: string;
  pct: number | null;
}

/**
 * "Item tax details" shown while linking an ERP repository record. The ERP sends GST group and
 * HSN/SAC per record; the shop stores them on the item (Item.TaxId / Item.HSN). Empty item
 * fields are filled by default; a value that differs from the item is only flagged, and the user
 * can opt in to overwrite. The GST group is matched to a tax slab by name, then by rate; if
 * nothing matches, the user picks a slab or (with Taxes access) creates one here.
 *
 * The decision is exposed as `change` (null = nothing to apply); the item page applies it after
 * the variant has been saved and linked.
 */
@Component({
  selector: 'app-repo-item-tax',
  imports: [FormsModule],
  templateUrl: './repo-item-tax.html',
})
export class RepoItemTax implements OnInit {
  private readonly items = inject(ItemService);
  private readonly taxesApi = inject(TaxesService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** From the ERP record. */
  readonly gstCode = input<string>('');
  readonly hsnCode = input<string>('');
  /** The item's current values (from the item form). */
  readonly itemTaxId = input<number>(0);
  readonly itemHsn = input<string>('');

  /** What to apply to the item after saving (null = nothing). */
  readonly change = model<RepoTaxChange | null>(null);

  readonly taxes = signal<TaxOption[]>([]);
  readonly loadingTaxes = signal(false);
  /** Slab found automatically for the GST code (0 = none) and how it was found. */
  readonly matchedTaxId = signal(0);
  readonly matchedBy = signal<'name' | 'rate' | null>(null);
  /** Slab the user will apply (starts as the automatic match). */
  readonly selectedTaxId = signal(0);
  readonly applyTax = signal(false);
  readonly applyHsn = signal(false);

  // Inline "create tax slab"
  readonly canCreateSlab = computed(() => this.auth.canAccess(['tax']));
  readonly showCreate = signal(false);
  readonly loadingNames = signal(false);
  readonly slabName = signal('');
  readonly slabComponents = signal<SlabComponent[]>([]);
  readonly savingSlab = signal(false);

  readonly erpHsn = computed(() => this.hsnCode().trim());
  readonly erpGst = computed(() => this.gstCode().trim());
  /** Rate in the GST code, e.g. 18 for "GST 18" (null when the code has no number). */
  readonly erpRate = computed(() => {
    const m = /(\d+(?:\.\d+)?)/.exec(this.erpGst());
    return m ? Number(m[1]) : null;
  });

  /** none: ERP sent no HSN · same: item already has it · fill: item empty · differs: item has another value. */
  readonly hsnState = computed<'none' | 'same' | 'fill' | 'differs'>(() => {
    const erp = this.erpHsn();
    const item = (this.itemHsn() ?? '').trim();
    if (!erp) return 'none';
    if (!item) return 'fill';
    return item.toLowerCase() === erp.toLowerCase() ? 'same' : 'differs';
  });

  /** none · loading · unmatched (no slab found) · same · fill · differs — for the chosen slab. */
  readonly taxState = computed<'none' | 'loading' | 'unmatched' | 'same' | 'fill' | 'differs'>(() => {
    if (!this.erpGst()) return 'none';
    if (this.loadingTaxes()) return 'loading';
    if (!this.matchedTaxId()) return 'unmatched';
    const current = Number(this.itemTaxId()) || 0;
    if (!current) return 'fill';
    return current === this.selectedTaxId() ? 'same' : 'differs';
  });

  readonly selectedTax = computed(() => this.taxes().find((t) => t.taxDetailsId === this.selectedTaxId()) ?? null);
  readonly currentTax = computed(() => this.taxes().find((t) => t.taxDetailsId === Number(this.itemTaxId())) ?? null);

  readonly slabTotal = computed(() =>
    Math.round(this.slabComponents().reduce((n, c) => n + (Number(c.pct) || 0), 0) * 100) / 100,
  );
  /** Problem with the new-slab form, or '' when it can be saved. */
  readonly slabProblem = computed(() => {
    const name = this.slabName().trim();
    if (!name) return 'Enter a name.';
    if (this.taxes().some((t) => norm(t.name) === norm(name))) return `A slab named "${name}" already exists.`;
    if (this.slabComponents().some((c) => Number(c.pct) < 0)) return "Percentages can't be negative.";
    if (this.slabTotal() <= 0) return 'Enter at least one percentage.';
    const rate = this.erpRate();
    if (rate !== null && Math.abs(this.slabTotal() - rate) > 0.001) {
      return `Components add up to ${this.slabTotal()}%, but ${this.erpGst()} is ${rate}%.`;
    }
    return '';
  });

  ngOnInit(): void {
    this.applyHsn.set(this.hsnState() === 'fill');
    if (this.erpGst()) this.loadTaxes();
    else this.emit();
  }

  private loadTaxes(selectName?: string): void {
    this.loadingTaxes.set(true);
    this.items.taxes().subscribe({
      next: (list) => {
        this.taxes.set(list);
        this.loadingTaxes.set(false);
        const found = selectName
          ? list.find((t) => norm(t.name) === norm(selectName)) ?? null
          : null;
        if (found) {
          this.setMatch(found.taxDetailsId, 'name');
        } else {
          this.autoMatch(list);
        }
        this.applyTax.set(this.taxState() === 'fill' || (!!found && this.taxState() !== 'same'));
        this.emit();
      },
      error: () => {
        this.loadingTaxes.set(false);
        this.emit();
      },
    });
  }

  /** Name first (ignoring case, spaces and punctuation), then a unique slab with the same total %. */
  private autoMatch(list: TaxOption[]): void {
    const code = norm(this.erpGst());
    const byName = list.find((t) => norm(t.name) === code);
    if (byName) return this.setMatch(byName.taxDetailsId, 'name');
    const rate = this.erpRate();
    if (rate !== null) {
      const byRate = list.filter((t) => Math.abs(t.total - rate) < 0.001);
      if (byRate.length === 1) return this.setMatch(byRate[0].taxDetailsId, 'rate');
    }
    this.setMatch(0, null);
  }

  private setMatch(id: number, by: 'name' | 'rate' | null): void {
    this.matchedTaxId.set(id);
    this.matchedBy.set(by);
    this.selectedTaxId.set(id);
  }

  toggleHsn(on: boolean): void {
    this.applyHsn.set(on);
    this.emit();
  }

  toggleTax(on: boolean): void {
    this.applyTax.set(on);
    this.emit();
  }

  /** Unmatched GST code: the user picks an existing slab by hand. */
  pickSlab(id: number | string): void {
    const n = Number(id) || 0;
    this.selectedTaxId.set(n);
    this.applyTax.set(n > 0 && n !== Number(this.itemTaxId()));
    this.emit();
  }

  private emit(): void {
    const hsnOn = this.applyHsn() && (this.hsnState() === 'fill' || this.hsnState() === 'differs');
    const taxId = this.selectedTaxId();
    const taxOn = this.applyTax() && taxId > 0 && taxId !== Number(this.itemTaxId());
    this.change.set(hsnOn || taxOn ? { hsn: hsnOn ? this.erpHsn() : null, taxId: taxOn ? taxId : null } : null);
  }

  // ── Create a missing slab ───────────────────────────────────
  openCreate(): void {
    this.showCreate.set(true);
    this.slabName.set(this.erpGst());
    this.loadingNames.set(true);
    this.taxesApi.getNames().subscribe({
      next: (n) => {
        this.loadingNames.set(false);
        const names = [n?.tax1Name, n?.tax2Name, n?.tax3Name, n?.tax4Name, n?.tax5Name];
        const comps: SlabComponent[] = names
          .map((label, i) => ({ slot: i + 1, label: (label ?? '').trim(), pct: 0 as number | null }))
          .filter((c) => c.label);
        if (!comps.length) {
          this.showCreate.set(false);
          this.toast.error('Name the tax components (e.g. CGST, SGST) in Settings → Taxes first.');
          return;
        }
        const rate = this.erpRate() ?? 0;
        const cgst = comps.find((c) => norm(c.label) === 'cgst');
        const sgst = comps.find((c) => norm(c.label) === 'sgst' || norm(c.label) === 'utgst');
        if (cgst && sgst) {
          // Intra-state GST: split evenly between CGST and SGST/UTGST.
          cgst.pct = rate / 2;
          sgst.pct = rate / 2;
        } else {
          comps[0].pct = rate;
        }
        this.slabComponents.set(comps);
      },
      error: () => {
        this.loadingNames.set(false);
        this.showCreate.set(false);
        this.toast.error('Could not load the tax component names.');
      },
    });
  }

  setComponentPct(slot: number, value: number | string | null): void {
    const pct = value === '' || value === null ? null : Number(value);
    this.slabComponents.update((list) => list.map((c) => (c.slot === slot ? { ...c, pct } : c)));
  }

  createSlab(): void {
    if (this.slabProblem()) return this.toast.error(this.slabProblem());
    const pct = (slot: number) => Number(this.slabComponents().find((c) => c.slot === slot)?.pct) || 0;
    const name = this.slabName().trim();
    this.savingSlab.set(true);
    this.taxesApi
      .saveDetail({
        taxDetailsId: 0,
        taxName: name,
        tax1Percentage: pct(1),
        tax2Percentage: pct(2),
        tax3Percentage: pct(3),
        tax4Percentage: pct(4),
        tax5Percentage: pct(5),
        isDefault: false,
      })
      .subscribe({
        next: () => {
          this.savingSlab.set(false);
          this.showCreate.set(false);
          this.toast.success(`Tax slab "${name}" created.`);
          this.loadTaxes(name);
        },
        error: (e: { message?: string }) => {
          this.savingSlab.set(false);
          this.toast.error(e?.message || 'Could not create the tax slab.');
        },
      });
  }
}

/** Lower-case and drop everything but letters, digits and dots ("GST 18" ≡ "gst-18" ≡ "GST18"). */
function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9.]/g, '');
}
