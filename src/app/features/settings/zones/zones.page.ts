import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ZonesService } from './zones.service';
import { Zone } from './zone.models';

@Component({
  selector: 'app-zones-page',
  imports: [ReactiveFormsModule],
  templateUrl: './zones.page.html',
})
export class ZonesPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ZonesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly zones = signal<Zone[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly searchQuery = signal<string>('');
  readonly selectedZoneId = signal<number | null>(null);

  /** Filter delivery zones based on search query */
  readonly filteredZones = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.zones();
    return this.zones().filter((z) => z.zoneName.toLowerCase().includes(query));
  });

  /** Active zone details */
  readonly selectedZone = computed(() =>
    this.zones().find((z) => z.zoneId === this.selectedZoneId())
  );

  readonly zoneForm = this.fb.nonNullable.group({
    zoneName: ['', [Validators.required]],
    country: ['INDIA'], // the .NET form always sends INDIA
    patterns: this.fb.array<ReturnType<ZonesPage['patternGroup']>>([]),
  });

  get patterns(): FormArray {
    return this.zoneForm.controls.patterns;
  }

  private patternGroup(zonePatternId = 0, zipPattern = '') {
    return this.fb.nonNullable.group({
      zonePatternId: [zonePatternId],
      zipPattern: [zipPattern, [Validators.required]],
    });
  }

  constructor() {
    this.load();
  }

  load(selectId?: number): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.zones.set(rows ?? []);
        this.loading.set(false);
        const list = rows ?? [];
        if (list.length > 0) {
          if (selectId !== undefined) {
            const found = list.find((z) => z.zoneId === selectId);
            if (found) {
              this.selectZone(found);
              return;
            }
          }
          const currentId = this.selectedZoneId();
          const current = list.find((z) => z.zoneId === currentId);
          if (current) {
            this.selectZone(current);
          } else {
            this.selectZone(list[0]);
          }
        } else {
          this.selectedZoneId.set(null);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  selectZone(zone: Zone): void {
    this.selectedZoneId.set(zone.zoneId);
    this.zoneForm.reset({ zoneName: zone.zoneName, country: 'INDIA' });
    this.patterns.clear();
    if (zone.patterns.length) {
      zone.patterns.forEach((p) =>
        this.patterns.push(this.patternGroup(p.zonePatternId, p.zipPattern))
      );
    } else {
      this.addPattern();
    }
  }

  openCreate(): void {
    this.selectedZoneId.set(0);
    this.zoneForm.reset({ zoneName: '', country: 'INDIA' });
    this.patterns.clear();
    this.addPattern();
  }

  addPattern(): void {
    this.patterns.push(this.patternGroup());
  }

  async removePattern(index: number): Promise<void> {
    const group = this.patterns.at(index);
    const zonePatternId = group.value.zonePatternId as number;
    if (zonePatternId > 0 && this.selectedZoneId()) {
      const ok = await this.confirm.ask(`Delete zip pattern "${group.value.zipPattern}"?`, { confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      this.service.deletePattern(this.selectedZoneId()!, zonePatternId).subscribe({
        next: (res) => {
          if (!this.isOk(res)) {
            this.toast.error(this.resultText(res) || 'Could not delete the pattern.');
            return;
          }
          this.patterns.removeAt(index);
          this.toast.success('Pattern removed.');
        },
        error: (e: { message?: string }) => this.toast.error(e?.message || 'Could not delete the pattern.'),
      });
    } else {
      this.patterns.removeAt(index);
    }
  }

  save(): void {
    if (this.zoneForm.invalid) {
      this.zoneForm.markAllAsTouched();
      this.toast.error('Zone name is required.');
      return;
    }
    const v = this.zoneForm.getRawValue();
    // Blank rows are ignored; duplicates are rejected (the .NET page refuses to add the same pattern twice).
    const patterns = (v.patterns as { zonePatternId: number; zipPattern: string }[])
      .map((p) => ({ ...p, zipPattern: (p.zipPattern ?? '').trim() }))
      .filter((p) => p.zipPattern);
    const seen = new Set<string>();
    for (const p of patterns) {
      const k = p.zipPattern.toLowerCase();
      if (seen.has(k)) {
        this.toast.error(`Zip pattern "${p.zipPattern}" is listed twice.`);
        return;
      }
      seen.add(k);
    }
    this.saving.set(true);
    const id = this.selectedZoneId() ?? 0;
    this.service
      .saveZone({
        zoneId: id,
        zoneName: v.zoneName,
        country: v.country,
        patterns,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          // The API answers 200 with data "ok", or e.g. "Allready_Exit" when the zone name is taken.
          if (!this.isOk(res)) {
            const r = this.resultText(res);
            this.toast.error(/exit|exist/i.test(r) ? 'A zone with this name already exists.' : r || 'Could not save the zone.');
            return;
          }
          this.toast.success(id ? 'Zone updated.' : 'Zone created.');
          this.load(id || undefined);
        },
        error: (e: { message?: string }) => {
          this.saving.set(false);
          this.toast.error(e?.message || 'Could not save the zone.');
        },
      });
  }

  async remove(): Promise<void> {
    const zone = this.selectedZone();
    if (!zone) return;
    const ok = await this.confirm.ask(`Delete zone "${zone.zoneName}"?`, {
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.service.deleteZone(zone.zoneId).subscribe({
      next: (res) => {
        if (!this.isOk(res)) {
          this.toast.error(this.resultText(res) || 'Could not delete the zone.');
          return;
        }
        this.toast.success('Zone deleted.');
        this.selectedZoneId.set(null);
        this.load();
      },
      error: (e: { message?: string }) => this.toast.error(e?.message || 'Could not delete the zone.'),
    });
  }

  /** Zone endpoints return a plain string in data: "ok" on success. */
  private resultText(res: unknown): string {
    return typeof res === 'string' ? res : String((res as Record<string, unknown> | null)?.['result'] ?? '');
  }

  private isOk(res: unknown): boolean {
    const r = this.resultText(res).trim().toLowerCase();
    return r === '' || r === 'ok';
  }
}
