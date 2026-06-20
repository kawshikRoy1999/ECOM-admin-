import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { StatusesService } from './statuses.service';
import { CancellationReason, CompanyStatus } from './status.models';

@Component({
  selector: 'app-statuses-page',
  imports: [FormsModule, ReactiveFormsModule, Tabs, DataTable, Modal],
  templateUrl: './statuses.page.html',
})
export class StatusesPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(StatusesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly tabs: TabItem[] = [
    { id: 'statuses', label: 'Status Names' },
    { id: 'cancellations', label: 'Cancellation Reasons' },
  ];
  readonly active = signal('statuses');

  // Statuses (inline edit)
  readonly statuses = signal<CompanyStatus[]>([]);
  readonly statusesLoading = signal(false);
  readonly savingStatusId = signal<number | null>(null);

  // Cancellation reasons
  readonly reasons = signal<CancellationReason[]>([]);
  readonly reasonsLoading = signal(false);
  readonly modalOpen = signal(false);
  readonly editingId = signal(0);
  readonly savingReason = signal(false);

  readonly reasonColumns: Column<CancellationReason>[] = [
    { key: 'reasonName', header: 'Reason' },
    { key: 'explanationRequired', header: 'Explanation', align: 'center', format: (r) => (r.explanationRequired ? 'Required' : 'Optional') },
    { key: 'isActive', header: 'Status', align: 'center', format: (r) => (r.isActive ? 'Active' : 'Inactive') },
  ];

  readonly reasonForm = this.fb.nonNullable.group({
    reasonName: ['', [Validators.required]],
    explanationRequired: [false],
    isActive: [true],
  });

  constructor() {
    this.loadStatuses();
    this.loadReasons();
  }

  // --- Statuses ---
  loadStatuses(): void {
    this.statusesLoading.set(true);
    this.service.getStatuses().subscribe({
      next: (rows) => {
        this.statuses.set(rows ?? []);
        this.statusesLoading.set(false);
      },
      error: () => this.statusesLoading.set(false),
    });
  }

  saveStatus(s: CompanyStatus): void {
    this.savingStatusId.set(s.statusId);
    this.service.saveStatus(s).subscribe({
      next: () => {
        this.savingStatusId.set(null);
        this.toast.success('Status saved.');
      },
      error: () => this.savingStatusId.set(null),
    });
  }

  // --- Cancellation reasons ---
  loadReasons(): void {
    this.reasonsLoading.set(true);
    this.service.getCancellations().subscribe({
      next: (rows) => {
        this.reasons.set(rows ?? []);
        this.reasonsLoading.set(false);
      },
      error: () => this.reasonsLoading.set(false),
    });
  }

  openCreate(): void {
    this.editingId.set(0);
    this.reasonForm.reset({ reasonName: '', explanationRequired: false, isActive: true });
    this.modalOpen.set(true);
  }

  openEdit(r: CancellationReason): void {
    this.editingId.set(r.cancellationReasonId);
    this.reasonForm.reset({
      reasonName: r.reasonName,
      explanationRequired: r.explanationRequired,
      isActive: r.isActive,
    });
    this.modalOpen.set(true);
  }

  saveReason(): void {
    if (this.reasonForm.invalid) {
      this.reasonForm.markAllAsTouched();
      return;
    }
    this.savingReason.set(true);
    const v = this.reasonForm.getRawValue();
    this.service
      .saveCancellation({
        cancellationReasonId: this.editingId(),
        reasonName: v.reasonName,
        explanationRequired: v.explanationRequired,
        isActive: v.isActive,
      })
      .subscribe({
        next: () => {
          this.savingReason.set(false);
          this.modalOpen.set(false);
          this.toast.success(this.editingId() ? 'Reason updated.' : 'Reason created.');
          this.loadReasons();
        },
        error: () => this.savingReason.set(false),
      });
  }

  async removeReason(r: CancellationReason): Promise<void> {
    const ok = await this.confirm.ask(`Delete reason "${r.reasonName}"?`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.service.deleteCancellation(r.cancellationReasonId).subscribe({
      next: () => {
        this.toast.success('Reason deleted.');
        this.loadReasons();
      },
    });
  }
}
