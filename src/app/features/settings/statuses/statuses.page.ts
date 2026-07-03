import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { Modal } from '../../../shared/ui/modal/modal';
import { Select } from '../../../shared/ui/select/select';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { StatusesService } from './statuses.service';
import { CancellationReason, CompanyStatus, CompanyOrderProcess } from './status.models';

@Component({
  selector: 'app-statuses-page',
  imports: [FormsModule, ReactiveFormsModule, Tabs, Modal, Select, ImageUpload],
  templateUrl: './statuses.page.html',
})
export class StatusesPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(StatusesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly tabs: TabItem[] = [
    { id: 'statuses', label: 'Status Names' },
    { id: 'orderSteps', label: 'Order Steps' },
    { id: 'cancellations', label: 'Cancellation Reasons' },
  ];
  readonly active = signal('statuses');

  // Statuses (inline edit)
  readonly statuses = signal<CompanyStatus[]>([]);
  readonly statusesLoading = signal(false);
  readonly savingStatusId = signal<number | null>(null);
  readonly editingStatusId = signal<number | null>(null);
  editStoreFrontStatus = '';
  readonly editCompanyOrderProcessId = signal<number>(0);

  // Order-workflow steps (master list + feeds the status → step mapping dropdown)
  readonly orderSteps = signal<CompanyOrderProcess[]>([]);
  readonly orderStepsLoading = signal(false);
  readonly stepModalOpen = signal(false);
  readonly editingStepId = signal(0);
  readonly savingStep = signal(false);
  readonly stepName = signal('');
  readonly stepIsActive = signal(true);
  readonly stepImage = signal('');

  // Cancellation reasons
  readonly reasons = signal<CancellationReason[]>([]);
  readonly reasonsLoading = signal(false);
  readonly modalOpen = signal(false);
  readonly editingId = signal(0);
  readonly savingReason = signal(false);

  readonly reasonForm = this.fb.nonNullable.group({
    reasonName: ['', [Validators.required]],
    explanationRequired: [false],
    isActive: [true],
  });

  constructor() {
    this.loadStatuses();
    this.loadReasons();
    this.loadOrderSteps();
  }

  // --- Order steps (master) ---
  loadOrderSteps(): void {
    this.orderStepsLoading.set(true);
    this.service.getOrderSteps().subscribe({
      next: (s) => {
        this.orderSteps.set(s ?? []);
        this.orderStepsLoading.set(false);
      },
      error: () => this.orderStepsLoading.set(false),
    });
  }

  openCreateStep(): void {
    this.editingStepId.set(0);
    this.stepName.set('');
    this.stepIsActive.set(true);
    this.stepImage.set('');
    this.stepModalOpen.set(true);
  }

  openEditStep(p: CompanyOrderProcess): void {
    this.editingStepId.set(p.companyOrderProcessId);
    this.stepName.set(p.name);
    this.stepIsActive.set(p.isActive);
    this.stepImage.set(p.imageUrl ?? '');
    this.stepModalOpen.set(true);
  }

  saveStep(): void {
    const name = this.stepName().trim();
    if (!name) {
      this.toast.error('Enter a step name.');
      return;
    }
    this.savingStep.set(true);
    this.service
      .saveOrderStep({
        companyOrderProcessId: this.editingStepId(),
        name,
        imageUrl: this.stepImage(),
        isActive: this.stepIsActive(),
      })
      .subscribe({
        next: () => {
          this.savingStep.set(false);
          this.stepModalOpen.set(false);
          this.toast.success(this.editingStepId() ? 'Step updated.' : 'Step created.');
          this.loadOrderSteps();
        },
        error: () => this.savingStep.set(false),
      });
  }

  async removeStep(p: CompanyOrderProcess): Promise<void> {
    const ok = await this.confirm.ask(`Delete order step "${p.name}"?`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.service.deleteOrderStep(p.companyOrderProcessId).subscribe({
      next: () => {
        this.toast.success('Step deleted.');
        this.loadOrderSteps();
      },
    });
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

  startEditStatus(s: CompanyStatus): void {
    this.editingStatusId.set(s.statusId);
    this.editStoreFrontStatus = s.storeFrontStatus ?? '';
    this.editCompanyOrderProcessId.set(s.companyOrderProcessId ?? 0);
  }

  cancelEditStatus(): void {
    this.editingStatusId.set(null);
    this.editStoreFrontStatus = '';
    this.editCompanyOrderProcessId.set(0);
  }

  saveStatus(s: CompanyStatus): void {
    s.storeFrontStatus = this.editStoreFrontStatus;
    s.companyOrderProcessId = this.editCompanyOrderProcessId() || null;
    this.savingStatusId.set(s.statusId);
    this.service.saveStatus(s).subscribe({
      next: () => {
        this.savingStatusId.set(null);
        this.editingStatusId.set(null);
        this.toast.success('Status saved.');
        this.loadStatuses();
      },
      error: () => this.savingStatusId.set(null),
    });
  }

  statusColorClass(statusName: string): string {
    const name = statusName.toLowerCase();
    if (name.includes('placed')) return 'bg-blue-50 text-blue-600 border border-blue-100/60';
    if (name.includes('processed') || name.includes('accept')) return 'bg-indigo-50 text-indigo-600 border border-indigo-100/60';
    if (name.includes('dispatch') || name.includes('ready')) return 'bg-amber-50 text-amber-600 border border-amber-100/60';
    if (name.includes('delivered')) return 'bg-emerald-50 text-emerald-600 border border-emerald-100/60';
    if (name.includes('cancel')) return 'bg-red-50 text-red-600 border border-red-100/60';
    return 'bg-slate-50 text-slate-500 border border-slate-100/60';
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
