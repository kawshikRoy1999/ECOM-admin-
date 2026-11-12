import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Modal } from '../../../shared/ui/modal/modal';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { CategoryService } from './category.service';
import { CategoryOption, OptionValue } from './category.models';
import { TooltipService } from '../../../shared/ui/tooltip.service';

@Component({
  selector: 'app-category-options',
  imports: [FormsModule, Modal],
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
  readonly values = signal<OptionValue[]>([]);
  /** Text in the "add value" box. */
  valueDraft = '';
  /** Index of the value chip being renamed (-1 = adding a new one). */
  readonly editingValueIndex = signal(-1);

  constructor() {
    queueMicrotask(() => this.load());
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
    this.values.set([]);
    this.valueDraft = '';
    this.editingValueIndex.set(-1);
  }

  editOption(o: CategoryOption): void {
    this.editingId.set(o.variantOptionId);
    this.optionName = o.optionName;
    this.isItemLevelAttribute = o.isItemLevelAttribute;
    this.values.set([]);
    this.valueDraft = '';
    this.editingValueIndex.set(-1);
    this.service.optionValues(o.variantOptionId).subscribe({
      next: (vals) => this.values.set(vals.filter((v) => v.value.trim())),
    });
  }

  /** Adds the typed value(s). Comma-separated text adds several at once; duplicates are skipped. */
  commitDraft(): void {
    const parts = this.valueDraft.split(',').map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    const editIdx = this.editingValueIndex();
    const list = [...this.values()];
    const exists = (t: string, skip = -1) => list.some((v, i) => i !== skip && v.value.trim().toLowerCase() === t.toLowerCase());

    if (editIdx >= 0) {
      const text = parts[0];
      if (exists(text, editIdx)) {
        this.toast.error(`"${text}" is already in the list.`);
        return;
      }
      list[editIdx] = { ...list[editIdx], value: text };
    } else {
      const skipped: string[] = [];
      for (const t of parts) {
        if (exists(t)) skipped.push(t);
        else list.push({ optionValueId: 0, value: t, displayOrder: 0 });
      }
      if (skipped.length) this.toast.error(`Already added: ${skipped.join(', ')}`);
    }
    this.values.set(list);
    this.valueDraft = '';
    this.editingValueIndex.set(-1);
  }

  onDraftKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      this.commitDraft();
    } else if (e.key === 'Escape' && this.editingValueIndex() >= 0) {
      this.valueDraft = '';
      this.editingValueIndex.set(-1);
    } else if (e.key === 'Backspace' && !this.valueDraft && this.editingValueIndex() < 0 && this.values().length) {
      const last = this.values()[this.values().length - 1];
      if (!last.optionValueId) this.removeValue(this.values().length - 1);
    }
  }

  /** Load a value into the box so it can be renamed (keeps its id). */
  startEditValue(index: number): void {
    this.editingValueIndex.set(index);
    this.valueDraft = this.values()[index].value;
  }

  removeValue(index: number): void {
    this.values.update((list) => list.filter((_, i) => i !== index));
    if (this.editingValueIndex() === index) {
      this.editingValueIndex.set(-1);
      this.valueDraft = '';
    }
  }

  saveOption(): void {
    if (!this.optionName.trim()) {
      this.toast.error('Option name is required.');
      return;
    }
    if (this.valueDraft.trim()) this.commitDraft(); // don't lose a value typed but not yet added
    if (!this.values().length) {
      this.toast.error('Add at least one value.');
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
