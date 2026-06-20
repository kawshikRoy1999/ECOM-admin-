import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { Modal } from '../../../shared/ui/modal/modal';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { LocationsService } from './locations.service';
import { Location } from './location.models';

@Component({
  selector: 'app-locations-page',
  imports: [ReactiveFormsModule, DataTable, Modal],
  templateUrl: './locations.page.html',
})
export class LocationsPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(LocationsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly rows = signal<Location[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly modalOpen = signal(false);
  readonly editingId = signal(0);

  readonly columns = computed<Column<Location>[]>(() => [
    { key: 'locationName', header: 'Location' },
    { key: 'city', header: 'City' },
    { key: 'state', header: 'State' },
    { key: 'contactPerson', header: 'Contact' },
  ]);

  readonly form = this.fb.nonNullable.group({
    locationName: ['', [Validators.required]],
    addressLine1: [''],
    addressLine2: [''],
    pin: [''],
    city: [''],
    district: [''],
    state: [''],
    country: [''],
    contactPerson: [''],
    contactPersonPhone: [''],
    contactPersonEmail: [''],
    bins: this.fb.array<ReturnType<LocationsPage['binGroup']>>([]),
  });

  get bins(): FormArray {
    return this.form.controls.bins;
  }

  private binGroup(binNumberId = 0, binNumber = '', isDefault = false) {
    return this.fb.nonNullable.group({
      binNumberId: [binNumberId],
      binNumber: [binNumber, [Validators.required]],
      isDefault: [isDefault],
    });
  }

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.rows.set(rows ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingId.set(0);
    this.form.reset({});
    this.bins.clear();
    this.modalOpen.set(true);
  }

  openEdit(loc: Location): void {
    this.editingId.set(loc.locationId);
    this.modalOpen.set(true);
    this.service.detail(loc.locationId).subscribe({
      next: (d) => {
        this.form.reset({
          locationName: d.locationName ?? '',
          addressLine1: d.addressLine1 ?? '',
          addressLine2: d.addressLine2 ?? '',
          pin: d.pin ?? '',
          city: d.city ?? '',
          district: d.district ?? d.dist ?? '',
          state: d.state ?? '',
          country: d.country ?? '',
          contactPerson: d.contactPerson ?? '',
          contactPersonPhone: d.contactPersonPhone ?? '',
          contactPersonEmail: d.contactPersonEmail ?? '',
        });
        this.bins.clear();
        (d.binDetails ?? []).forEach((b) =>
          this.bins.push(this.binGroup(b.binId, b.binName, b.isDefault)),
        );
      },
    });
  }

  addBin(): void {
    this.bins.push(this.binGroup());
  }

  removeBin(index: number): void {
    this.bins.removeAt(index);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.service
      .save({
        locationId: this.editingId(),
        locationName: v.locationName,
        addressLine1: v.addressLine1,
        addressLine2: v.addressLine2,
        pin: v.pin,
        city: v.city,
        district: v.district,
        state: v.state,
        country: v.country,
        contactPerson: v.contactPerson,
        contactPersonPhone: v.contactPersonPhone,
        contactPersonEmail: v.contactPersonEmail,
        bins: v.bins as { binNumberId: number; binNumber: string; isDefault: boolean }[],
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.toast.success(this.editingId() ? 'Location updated.' : 'Location created.');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  async remove(loc: Location): Promise<void> {
    const ok = await this.confirm.ask(`Delete location "${loc.locationName}"?`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.service.delete(loc.locationId).subscribe({
      next: () => {
        this.toast.success('Location deleted.');
        this.load();
      },
    });
  }
}
