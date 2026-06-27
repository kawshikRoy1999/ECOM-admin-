import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../../shared/ui/modal/modal';
import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { CategoryService } from './category.service';
import { CategoryOption, OptionValue } from './category.models';
import { TooltipService } from '../../../shared/ui/tooltip.service';

@Component({
  selector: 'app-category-options',
  imports: [FormsModule, Modal, Checkbox],
  templateUrl: './category-options.html',
})
export class CategoryOptions {
  private readonly service = inject(CategoryService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  public readonly tooltip = inject(TooltipService);

  readonly categoryId = input.required<number>();
  readonly subCategoryId = input<number>(0);
  readonly contextName = input<string>('');
  readonly close = output<void>();

  readonly options = signal<CategoryOption[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);

  // Editor state
  readonly editingId = signal(0);
  optionName = '';
  isItemLevelAttribute = false;
  readonly values = signal<OptionValue[]>([this.blankValue()]);

  constructor() {
    queueMicrotask(() => this.load());
  }

  private blankValue(): OptionValue {
    return { optionValueId: 0, value: '', displayOrder: 0 };
  }

  load(): void {
    this.loading.set(true);
    this.service.options(this.categoryId(), this.subCategoryId()).subscribe({
      next: (rows) => {
        this.options.set([...rows].sort((a, b) => a.displayOrder - b.displayOrder));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  resetEditor(): void {
    this.editingId.set(0);
    this.optionName = '';
    this.isItemLevelAttribute = false;
    this.values.set([this.blankValue()]);
  }

  editOption(o: CategoryOption): void {
    this.editingId.set(o.variantOptionId);
    this.optionName = o.optionName;
    this.isItemLevelAttribute = o.isItemLevelAttribute;
    this.values.set([this.blankValue()]);
    this.service.optionValues(o.variantOptionId).subscribe({
      next: (vals) => this.values.set(vals.length ? vals : [this.blankValue()]),
    });
  }

  addValueRow(): void {
    this.values.update((list) => [...list, this.blankValue()]);
  }

  removeValueRow(index: number): void {
    this.values.update((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  updateValue(index: number, text: string): void {
    this.values.update((list) => list.map((v, i) => (i === index ? { ...v, value: text } : v)));
  }

  saveOption(): void {
    if (!this.optionName.trim()) {
      this.toast.error('Option name is required.');
      return;
    }
    this.saving.set(true);
    const opt: CategoryOption = {
      variantOptionId: this.editingId(),
      categoryId: this.categoryId(),
      subCategoryId: this.subCategoryId(),
      optionName: this.optionName.trim(),
      displayOrder: 0,
      isItemLevelAttribute: this.isItemLevelAttribute,
    };
    this.service.saveOption(opt, this.values()).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.editingId() ? 'Option updated.' : 'Option added.');
        this.resetEditor();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async deleteOption(o: CategoryOption): Promise<void> {
    const ok = await this.confirm.ask(`Delete option "${o.optionName}"?`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.service.deleteOption(o.variantOptionId).subscribe({
      next: () => {
        this.toast.success('Option deleted.');
        if (this.editingId() === o.variantOptionId) this.resetEditor();
        this.load();
      },
    });
  }

  moveOption(index: number, dir: -1 | 1): void {
    const list = [...this.options()];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.options.set(list);
    this.service
      .saveOptionOrder(this.categoryId(), this.subCategoryId(), list.map((o) => o.variantOptionId))
      .subscribe({ next: () => this.toast.success('Order saved.'), error: () => this.load() });
  }
}
