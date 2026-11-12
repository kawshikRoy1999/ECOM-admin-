import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { TaxesService } from './taxes.service';
import { EMPTY_TAX_NAME, TaxDetail, TaxName } from './tax.models';

interface TaxComponent {
  index: number;
  name: string;
  pctKey: 'tax1Percentage' | 'tax2Percentage' | 'tax3Percentage' | 'tax4Percentage' | 'tax5Percentage';
}

@Component({
  selector: 'app-taxes-page',
  imports: [ReactiveFormsModule, DataTable, Modal, DecimalPipe],
  templateUrl: './taxes.page.html',
})
export class TaxesPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TaxesService);
  private readonly toast = inject(ToastService);

  readonly names = signal<TaxName>(EMPTY_TAX_NAME);
  readonly details = signal<TaxDetail[]>([]);
  readonly inclusive = signal(false);
  readonly loading = signal(false);
  readonly savingNames = signal(false);
  readonly savingDetail = signal(false);
  readonly modalOpen = signal(false);
  readonly editingId = signal(0);

  /** Named tax components only (drive the slab inputs + table columns). */
  readonly components = computed<TaxComponent[]>(() => {
    const n = this.names();
    return ([1, 2, 3, 4, 5] as const)
      .map((i) => ({
        index: i,
        name: (n[`tax${i}Name` as keyof TaxName] as string) ?? '',
        pctKey: `tax${i}Percentage` as TaxComponent['pctKey'],
      }))
      .filter((c) => c.name.trim());
  });

  readonly columns = computed<Column<TaxDetail>[]>(() => [
    { key: 'taxName', header: 'Tax slab' },
    // One column per named component (CGST, SGST…), as the .NET tax list shows.
    ...this.components().map((c) => ({
      key: c.pctKey,
      header: `${c.name} %`,
      align: 'right' as const,
      format: (d: TaxDetail) => Number(d[c.pctKey] ?? 0).toFixed(2),
    })),
    { key: 'tax1Percentage', header: 'Total %', align: 'right', format: (d) => `${this.total(d).toFixed(2)}%` },
    { key: 'isDefault', header: 'Default', align: 'center', format: (d) => (d.isDefault ? '✓' : '') },
  ]);

  readonly namesForm = this.fb.nonNullable.group({
    tax1Name: [''],
    tax2Name: [''],
    tax3Name: [''],
    tax4Name: [''],
    tax5Name: [''],
  });

  readonly detailForm = this.fb.nonNullable.group({
    taxName: ['', [Validators.required]],
    tax1Percentage: [0, [Validators.min(0), Validators.max(100)]],
    tax2Percentage: [0, [Validators.min(0), Validators.max(100)]],
    tax3Percentage: [0, [Validators.min(0), Validators.max(100)]],
    tax4Percentage: [0, [Validators.min(0), Validators.max(100)]],
    tax5Percentage: [0, [Validators.min(0), Validators.max(100)]],
    isDefault: [false],
  });

  constructor() {
    this.load();
  }

  /** Live total of the slab in the editor (the .NET form updates it as you type). */
  formTotal(): number {
    const v = this.detailForm.getRawValue();
    return [v.tax1Percentage, v.tax2Percentage, v.tax3Percentage, v.tax4Percentage, v.tax5Percentage]
      .reduce((sum, x) => sum + (Number(x) || 0), 0);
  }

  total(d: TaxDetail): number {
    return (
      Number(d.tax1Percentage) +
      Number(d.tax2Percentage) +
      Number(d.tax3Percentage) +
      Number(d.tax4Percentage) +
      Number(d.tax5Percentage)
    );
  }

  load(): void {
    this.loading.set(true);
    this.service.getNames().subscribe({
      next: (n) => {
        if (n) {
          this.names.set(n);
          this.namesForm.reset({
            tax1Name: n.tax1Name ?? '',
            tax2Name: n.tax2Name ?? '',
            tax3Name: n.tax3Name ?? '',
            tax4Name: n.tax4Name ?? '',
            tax5Name: n.tax5Name ?? '',
          });
        }
      },
    });
    this.service.getDetails().subscribe({
      next: (rows) => {
        this.details.set(rows ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    // Prices Include Tax is not needed for now — its load call is disabled (the switch is commented out in the template).
    // this.service.getInclusive().subscribe({ next: (v) => this.inclusive.set(!!v) });
  }

  saveNames(): void {
    this.savingNames.set(true);
    this.service.updateNames(this.namesForm.getRawValue()).subscribe({
      next: () => {
        this.savingNames.set(false);
        this.names.update((n) => ({ ...n, ...this.namesForm.getRawValue() }));
        this.toast.success('Tax names saved.');
      },
      error: (e: { message?: string }) => {
        this.savingNames.set(false);
        this.toast.error(e?.message || 'Could not save the tax names.');
      },
    });
  }

  toggleInclusive(checked: boolean): void {
    // Set first so the binding can flip the switch back if the save fails.
    this.inclusive.set(checked);
    this.service.setInclusive(checked).subscribe({
      next: () => {
        this.toast.success(checked ? 'Prices set to tax-inclusive.' : 'Prices set to tax-exclusive.');
      },
      error: (e: { message?: string }) => {
        // put the switch back so it reflects what is actually saved
        this.inclusive.set(!checked);
        this.toast.error(e?.message || 'Could not update the setting.');
      },
    });
  }

  openCreate(): void {
    this.editingId.set(0);
    this.detailForm.reset({
      taxName: '',
      tax1Percentage: 0,
      tax2Percentage: 0,
      tax3Percentage: 0,
      tax4Percentage: 0,
      tax5Percentage: 0,
      isDefault: false,
    });
    this.modalOpen.set(true);
  }

  openEdit(d: TaxDetail): void {
    this.editingId.set(d.taxDetailsId);
    this.detailForm.reset({
      taxName: d.taxName,
      tax1Percentage: d.tax1Percentage,
      tax2Percentage: d.tax2Percentage,
      tax3Percentage: d.tax3Percentage,
      tax4Percentage: d.tax4Percentage,
      tax5Percentage: d.tax5Percentage,
      isDefault: d.isDefault,
    });
    this.modalOpen.set(true);
  }

  saveDetail(): void {
    if (this.detailForm.invalid) {
      this.detailForm.markAllAsTouched();
      this.toast.error('Enter a slab name and percentages between 0 and 100.');
      return;
    }
    this.savingDetail.set(true);
    this.service.saveDetail({ taxDetailsId: this.editingId(), ...this.detailForm.getRawValue() }).subscribe({
      next: () => {
        this.savingDetail.set(false);
        this.modalOpen.set(false);
        this.toast.success(this.editingId() ? 'Tax slab updated.' : 'Tax slab created.');
        this.load();
      },
      error: (e: { message?: string }) => {
        this.savingDetail.set(false);
        this.toast.error(e?.message || 'Could not save the tax slab.');
      },
    });
  }
}
