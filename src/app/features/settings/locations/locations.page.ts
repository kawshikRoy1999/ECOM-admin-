import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { LocationsService } from './locations.service';
import { Location } from './location.models';

@Component({
  selector: 'app-locations-page',
  imports: [ReactiveFormsModule],
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
  
  readonly selectedLocationId = signal<number | null>(null);
  readonly searchQuery = signal('');

  readonly selectedLocation = computed(() => 
    this.rows().find((r) => r.locationId === this.selectedLocationId())
  );

  readonly filteredLocations = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.rows();
    if (!q) return list;
    return list.filter((r) =>
      (r.locationName ?? '').toLowerCase().includes(q) ||
      (r.city ?? '').toLowerCase().includes(q) ||
      (r.state ?? '').toLowerCase().includes(q) ||
      (r.contactPerson ?? '').toLowerCase().includes(q)
    );
  });

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
    this.selectedLocationId.set(0);
    this.form.reset({});
    this.bins.clear();
  }

  selectLocation(loc: Location): void {
    this.selectedLocationId.set(loc.locationId);
    this.loading.set(true);
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
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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
        locationId: this.selectedLocationId() ?? 0,
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
          this.toast.success(this.selectedLocationId() ? 'Location updated.' : 'Location created.');
          this.selectedLocationId.set(null);
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  async remove(loc?: Location): Promise<void> {
    const target = loc ?? this.selectedLocation();
    if (!target) return;
    const ok = await this.confirm.ask(`Delete location "${target.locationName}"?`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.service.delete(target.locationId).subscribe({
      next: () => {
        this.toast.success('Location deleted.');
        this.selectedLocationId.set(null);
        this.load();
      },
    });
  }
}
