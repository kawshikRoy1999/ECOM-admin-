import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { ColorPicker } from '../../../shared/ui/color-picker/color-picker';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { CompanyService } from './company.service';
import { BusinessUnit } from './company.models';

@Component({
  selector: 'app-business-units',
  imports: [FormsModule, Checkbox, ColorPicker],
  templateUrl: './business-units.html',
})
export class BusinessUnits {
  private readonly service = inject(CompanyService);
  private readonly toast = inject(ToastService);

  readonly units = signal<BusinessUnit[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly search = signal('');

  /** id of the row being edited (0 = the new-row draft), or null. */
  readonly editingId = signal<number | null>(null);
  /** editable copy of the row in edit mode. */
  draft: BusinessUnit = this.blank();

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const list = this.units();
    if (!q) return list;
    return list.filter(
      (u) => u.unitName?.toLowerCase().includes(q) || u.unitCode?.toLowerCase().includes(q),
    );
  });

  constructor() {
    this.load();
  }

  private blank(): BusinessUnit {
    return { businessUnitId: 0, unitName: '', unitCode: '', isActive: true, fontColor: '#000000', backgroundColor: '#ffffff' };
  }

  load(): void {
    this.loading.set(true);
    this.service.listBusinessUnits().subscribe({
      next: (rows) => {
        this.units.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  startEdit(u: BusinessUnit): void {
    this.editingId.set(u.businessUnitId);
    this.draft = { ...u };
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.draft = this.blank();
  }

  addNew(): void {
    this.editingId.set(0);
    this.draft = this.blank();
  }

  save(): void {
    if (!this.draft.unitName.trim()) {
      this.toast.error('Unit name is required.');
      return;
    }
    this.saving.set(true);
    this.service.saveBusinessUnit(this.draft).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Business unit saved.');
        this.cancelEdit();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  toggle(u: BusinessUnit): void {
    this.service.toggleBusinessUnit(u.businessUnitId).subscribe({
      next: () => {
        // optimistic flip; reload to stay in sync
        this.units.update((list) =>
          list.map((x) => (x.businessUnitId === u.businessUnitId ? { ...x, isActive: !x.isActive } : x)),
        );
        this.toast.success(u.isActive ? 'Business unit deactivated.' : 'Business unit activated.');
      },
    });
  }
}
