import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, switchMap } from 'rxjs';

import { ImageUpload } from '../../shared/ui/image-upload/image-upload';
import { DatePicker } from '../../shared/ui/date-picker/date-picker';
import { Select } from '../../shared/ui/select/select';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TooltipService } from '../../shared/ui/tooltip.service';
import { ConfirmService } from '../../shared/ui/confirm/confirm.service';
import { OffersService } from './offers.service';
import {
  ActiveRule,
  CriteriaOption,
  OfferListItem,
  RuleType,
  SubCategoryNode,
  VariantResult,
} from './offer.models';

@Component({
  selector: 'app-offers-page',
  imports: [ReactiveFormsModule, ImageUpload, DatePicker, Select],
  templateUrl: './offers.page.html',
})
export class OffersPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(OffersService);
  private readonly toast = inject(ToastService);
  public readonly tooltip = inject(TooltipService);
  private readonly confirm = inject(ConfirmService);
  readonly deleting = signal(false);

  readonly offers = signal<OfferListItem[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly syncing = signal(false);
  readonly loadingDetails = signal(false);
  readonly selectedOfferId = signal<number | null>(null);

  readonly searchQuery = signal<string>('');
  readonly bannerUrl = signal('');
  readonly iconUrl = signal('');
  readonly isGroupOffer = signal(true);

  // Staged targeting rules ("Active Rules").
  readonly rules = signal<ActiveRule[]>([]);

  // Group-mode pickers
  readonly categoryOptions = signal<CriteriaOption[]>([]);
  readonly brandOptions = signal<CriteriaOption[]>([]);
  readonly subcategoryNodes = signal<SubCategoryNode[]>([]);
  readonly selBrand = signal(0);
  readonly selCategory = signal(0);
  readonly selSubCategory = signal(0);
  readonly selFamily = signal(0);

  readonly subcategories = computed(() => this.subcategoryNodes().filter((n) => !n.parentId));
  readonly families = computed(() =>
    this.subcategoryNodes().filter((n) => n.parentId === this.selSubCategory()),
  );

  // Variant-mode search
  readonly variantTerm = signal('');
  readonly variantResults = signal<VariantResult[]>([]);
  readonly variantSearching = signal(false);
  private readonly variantSearch$ = new Subject<string>();

  /** Filter offers based on search query */
  readonly filteredOffers = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.offers();
    return this.offers().filter((o) => o.offerName.toLowerCase().includes(query));
  });

  /** Active selected offer */
  readonly selectedOffer = computed(() =>
    this.offers().find((o) => o.offerId === this.selectedOfferId())
  );

  readonly form = this.fb.nonNullable.group({
    offerName: ['', [Validators.required]],
    discountPercentage: [0, [Validators.required, Validators.min(0.01), Validators.max(100)]],
    // Optional, as in the .NET page — blank dates are sent as today.
    startDate: [''],
    endDate: [''],
    maxOrderQtyPerItem: [0, [Validators.min(0)]],
    isActive: [true],
  });

  constructor() {
    this.load();
    // After the option caches arrive, re-resolve any rule names still missing
    // (handles the race where an offer is selected before these finish loading).
    this.service.categoryOptions().subscribe({
      next: (o) => {
        this.categoryOptions.set(o);
        this.resolveRuleNames();
      },
    });
    this.service.brandOptions().subscribe({
      next: (o) => {
        this.brandOptions.set(o);
        this.resolveRuleNames();
      },
    });

    this.variantSearch$
      .pipe(
        debounceTime(300),
        switchMap((term) => {
          this.variantSearching.set(true);
          return this.service.searchVariants({
            search: term,
            page: 1,
            categoryId: this.selCategory(),
            brandId: this.selBrand(),
            subCategoryId: this.selFamily() || this.selSubCategory(),
          });
        }),
      )
      .subscribe({
        next: (res) => {
          this.variantResults.set(res.items);
          this.variantSearching.set(false);
        },
        error: () => this.variantSearching.set(false),
      });
  }

  fmtDate(d: string): string {
    return d ? d.slice(0, 10) : '';
  }

  load(selectId?: number): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.offers.set(rows ?? []);
        this.loading.set(false);
        const list = rows ?? [];
        if (list.length > 0) {
          if (selectId !== undefined) {
            const found = list.find((o) => o.offerId === selectId);
            if (found) {
              this.selectOffer(found);
              return;
            }
          }
          const currentId = this.selectedOfferId();
          const current = list.find((o) => o.offerId === currentId);
          if (current) {
            this.selectOffer(current);
          } else {
            this.selectOffer(list[0]);
          }
        } else {
          this.selectedOfferId.set(null);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  selectOffer(offer: OfferListItem): void {
    this.selectedOfferId.set(offer.offerId);
    this.resetPickers();
    this.loadingDetails.set(true);
    this.service.details(offer.offerId).subscribe({
      next: (d) => {
        const o = d?.offer;
        this.bannerUrl.set(o?.bannerImageUrl ?? '');
        this.iconUrl.set(o?.offerIconUrl ?? '');
        this.isGroupOffer.set(o?.isGroupOffer ?? false);
        this.rules.set(
          (d?.criteria ?? []).map((c) => {
            const type = this.normalizeRuleType(c.criteriaType);
            const id = c.criteriaValueId;
            // gateway often returns no name (or name === id) — resolve below
            const raw = (c.criteriaValueName ?? '').toString().trim();
            const name = !raw || raw === String(id) ? '' : raw;
            return { type, id, name } as ActiveRule;
          }),
        );
        this.resolveRuleNames();
        this.form.reset({
          offerName: o?.offerName ?? '',
          discountPercentage: o?.discountPercentage ?? 0,
          startDate: this.fmtDate(o?.startDate ?? ''),
          endDate: this.fmtDate(o?.endDate ?? ''),
          maxOrderQtyPerItem: Number(o?.maxOrderQtyPerItem ?? 0),
          isActive: o?.isActive ?? true,
        });
        this.loadingDetails.set(false);
      },
      error: () => this.loadingDetails.set(false),
    });
  }

  /** Normalize gateway criteria type strings to our RuleType union. */
  private normalizeRuleType(type: string): RuleType {
    const t = (type ?? '').toLowerCase();
    if (t === 'categoryid' || t === 'category') return 'Category';
    if (t === 'subcategoryid' || t === 'subcategory') return 'SubCategory';
    if (t === 'brandid' || t === 'brand') return 'Brand';
    return 'Variant';
  }

  /**
   * Fill in display names for staged rules that came back without one.
   * Category/Brand resolve from the cached option lists; Variants via the batch
   * report; SubCategories by fetching each category's subcategory tree.
   * Mirrors the .NET ResolveMissingNames().
   */
  private resolveRuleNames(): void {
    const missing = (r: ActiveRule) => !r.name || r.name === String(r.id);
    if (!this.rules().some(missing)) return;

    // 1. Category / Brand — synchronous, from the loaded caches.
    this.rules.update((list) =>
      list.map((r) => {
        if (!missing(r)) return r;
        if (r.type === 'Category') {
          const c = this.categoryOptions().find((o) => o.id === r.id);
          if (c) return { ...r, name: c.name };
        } else if (r.type === 'Brand') {
          const b = this.brandOptions().find((o) => o.id === r.id);
          if (b) return { ...r, name: b.name };
        }
        return r;
      }),
    );

    // 2. Variants — one batch-report call, filter by id.
    const variantIds = this.rules().filter((r) => r.type === 'Variant' && missing(r)).map((r) => r.id);
    if (variantIds.length) {
      this.service.resolveVariants(variantIds).subscribe({
        next: (variants) => {
          this.rules.update((list) =>
            list.map((r) => {
              if (r.type !== 'Variant' || !missing(r)) return r;
              const v = variants.find((x) => x.id === r.id);
              return v ? { ...r, name: v.text, imageUrl: v.imageUrl } : r;
            }),
          );
        },
      });
    }

    // 3. SubCategories — fetch each category's subcategory tree and match.
    const scMissing = this.rules().some((r) => r.type === 'SubCategory' && missing(r));
    if (scMissing) {
      for (const cat of this.categoryOptions()) {
        this.service.subcategories(cat.id).subscribe({
          next: (nodes) => {
            this.rules.update((list) =>
              list.map((r) => {
                if (r.type !== 'SubCategory' || !missing(r)) return r;
                const n = nodes.find((x) => x.id === r.id);
                return n ? { ...r, name: n.name } : r;
              }),
            );
          },
        });
      }
    }
  }

  openCreate(): void {
    this.selectedOfferId.set(0);
    this.bannerUrl.set('');
    this.iconUrl.set('');
    this.isGroupOffer.set(false); // .NET starts a new offer in individual-variant mode
    this.rules.set([]);
    this.resetPickers();
    this.form.reset({ offerName: '', discountPercentage: 0, startDate: '', endDate: '', maxOrderQtyPerItem: 0, isActive: true });
  }

  toggleGroupMode(group: boolean): void {
    this.isGroupOffer.set(group);
    this.rules.update((list) =>
      group ? list.filter((r) => r.type !== 'Variant') : list.filter((r) => r.type === 'Variant'),
    );
    this.resetPickers();
  }

  private resetPickers(): void {
    this.selBrand.set(0);
    this.selCategory.set(0);
    this.selSubCategory.set(0);
    this.selFamily.set(0);
    this.subcategoryNodes.set([]);
    this.variantTerm.set('');
    this.variantResults.set([]);
  }

  onCategoryChange(id: number): void {
    this.selCategory.set(Number(id));
    this.selSubCategory.set(0);
    this.selFamily.set(0);
    this.subcategoryNodes.set([]);
    if (id) {
      this.service.subcategories(Number(id)).subscribe({ next: (n) => this.subcategoryNodes.set(n) });
    }
  }

  onSubCategoryChange(id: number): void {
    this.selSubCategory.set(Number(id));
    this.selFamily.set(0);
  }

  stageGroupRule(): void {
    let added = false;
    if (this.selFamily()) {
      added = this.addRule('SubCategory', this.selFamily(), this.optName(this.families(), this.selFamily())) || added;
    } else if (this.selSubCategory()) {
      added = this.addRule('SubCategory', this.selSubCategory(), this.optName(this.subcategories(), this.selSubCategory())) || added;
    } else if (this.selCategory()) {
      added = this.addRule('Category', this.selCategory(), this.optName(this.categoryOptions(), this.selCategory())) || added;
    }
    if (this.selBrand()) {
      added = this.addRule('Brand', this.selBrand(), this.optName(this.brandOptions(), this.selBrand())) || added;
    }
    if (!added) {
      this.toast.error('Select at least one targeting criterion.');
      return;
    }
    this.resetPickers();
  }

  private optName(opts: { id: number; name: string }[], id: number): string {
    return opts.find((o) => o.id === id)?.name ?? String(id);
  }

  onVariantTerm(term: string): void {
    this.variantTerm.set(term);
    this.variantSearch$.next(term);
  }

  stageVariant(v: VariantResult): void {
    if (this.addRule('Variant', v.id, v.text, v.imageUrl)) {
      this.variantResults.update((list) => list.filter((r) => r.id !== v.id));
    }
  }

  private addRule(type: RuleType, id: number, name: string, imageUrl = ''): boolean {
    if (!id) return false;
    if (this.rules().some((r) => r.type === type && r.id === id)) return false;
    this.rules.update((list) => [...list, { type, id, name, imageUrl }]);
    return true;
  }

  removeRule(index: number): void {
    this.rules.update((list) => list.filter((_, i) => i !== index));
  }

  clearRules(): void {
    this.rules.set([]);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Title and a discount between 0 and 100 are required.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    this.saving.set(true);
    const v = this.form.getRawValue();
    const id = this.selectedOfferId() ?? 0;
    this.service
      .save({
        offerId: id,
        offerName: v.offerName,
        discountPercentage: Number(v.discountPercentage),
        startDate: v.startDate || today,
        endDate: v.endDate || today,
        bannerImageUrl: this.bannerUrl(),
        offerIconUrl: this.iconUrl(),
        maxOrderQtyPerItem: Number(v.maxOrderQtyPerItem) || 0,
        isActive: v.isActive,
        isGroupOffer: this.isGroupOffer(),
        criteria: this.rules().map((r) => ({ type: r.type, id: r.id, name: r.name })),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success(id ? 'Offer updated.' : 'Offer created.');
          this.load(id || undefined);
        },
        error: (e: { message?: string }) => {
          this.saving.set(false);
          this.toast.error(e?.message || 'Could not save the offer.');
        },
      });
  }

  syncToStore(): void {
    const id = this.selectedOfferId();
    if (!id) return;
    this.syncing.set(true);
    this.service.syncToStore(id).subscribe({
      next: () => {
        this.syncing.set(false);
        this.toast.success('Offer synced to store.');
      },
      error: () => this.syncing.set(false),
    });
  }

  /**
   * Activate / deactivate. The .NET page has no separate toggle — active is a field saved with the offer —
   * so this flips the switch and saves the offer as it stands.
   */
  toggleActive(): void {
    if (!this.selectedOfferId()) return;
    this.form.controls.isActive.setValue(!this.form.controls.isActive.value);
    this.save();
  }

  /** Delete the offer (the .NET list's trash action: AdminToggleOfferStatus with ActionType "Delete"). */
  async deleteOffer(): Promise<void> {
    const id = this.selectedOfferId();
    if (!id) return;
    const ok = await this.confirm.ask(`Delete offer "${this.form.controls.offerName.value}"? This permanently removes it from your store.`, {
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    this.service.delete(id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.success('Offer deleted.');
        this.openCreate();
        this.load();
      },
      error: (e: { message?: string }) => {
        this.deleting.set(false);
        this.toast.error(e?.message || 'Could not delete the offer.');
      },
    });
  }
}
