import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { Modal } from '../../../shared/ui/modal/modal';
import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { Select } from '../../../shared/ui/select/select';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { CategoryService } from './category.service';
import { CategoryOptions } from './category-options';
import { BusinessUnitOption, Category, SubCategory } from './category.models';

type View = 'categories' | 'subs' | 'subsubs';

@Component({
  selector: 'app-category-page',
  imports: [ReactiveFormsModule, FormsModule, Modal, Checkbox, Select, ImageUpload, CategoryOptions],
  templateUrl: './category.page.html',
})
export class CategoryPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CategoryService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly view = signal<View>('categories');
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly categories = signal<Category[]>([]);
  readonly subs = signal<SubCategory[]>([]);
  readonly subSubs = signal<SubCategory[]>([]);
  readonly businessUnits = signal<BusinessUnitOption[]>([]);

  readonly selectedCategory = signal<Category | null>(null);
  readonly selectedSub = signal<SubCategory | null>(null);

  readonly search = signal('');

  // Options modal (works at category / sub / sub-sub level)
  readonly optionsOpen = signal(false);
  readonly optionsCategoryId = signal(0);
  readonly optionsSubCategoryId = signal(0);
  readonly optionsContext = signal('');

  // Category modal
  readonly catModalOpen = signal(false);
  readonly editingCatId = signal(0);
  readonly catImage = signal(''); // banner (imageName)
  readonly catIcon = signal(''); // logo (iconImage)
  readonly catForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    returnWindowInDays: [0],
    nonReturnable: [false],
    businessUnitId: [0],
  });

  // Sub / sub-sub modal (shared)
  readonly subModalOpen = signal(false);
  readonly editingSubId = signal(0);
  readonly subForm = this.fb.nonNullable.group({
    subCategoryName: ['', [Validators.required]],
    sortOrder: [0],
    returnWindowInDays: [0],
    nonReturnable: [false],
    isActive: [true],
  });

  readonly filteredCategories = computed(() => {
    const q = this.search().toLowerCase().trim();
    const list = this.categories();
    return q ? list.filter((c) => c.name?.toLowerCase().includes(q)) : list;
  });

  constructor() {
    this.loadCategories();
    this.service.businessUnits().subscribe({ next: (b) => this.businessUnits.set(b) });
  }

  // --- Navigation ---
  loadCategories(): void {
    this.view.set('categories');
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.categories.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCategory(cat: Category): void {
    this.selectedCategory.set(cat);
    this.view.set('subs');
    this.loading.set(true);
    this.service.subCategories(cat.categoryId).subscribe({
      next: (rows) => {
        this.subs.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openSub(sub: SubCategory): void {
    this.selectedSub.set(sub);
    this.view.set('subsubs');
    this.loading.set(true);
    this.service.subSubCategories(sub.subCategoryId).subscribe({
      next: (rows) => {
        this.subSubs.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  backToCategories(): void {
    this.selectedCategory.set(null);
    this.selectedSub.set(null);
    this.view.set('categories');
  }

  backToSubs(): void {
    this.selectedSub.set(null);
    this.view.set('subs');
  }

  private reloadCurrentSubs(): void {
    const cat = this.selectedCategory();
    if (cat) this.service.subCategories(cat.categoryId).subscribe({ next: (r) => this.subs.set(r) });
  }

  private reloadCurrentSubSubs(): void {
    const sub = this.selectedSub();
    if (sub) this.service.subSubCategories(sub.subCategoryId).subscribe({ next: (r) => this.subSubs.set(r) });
  }

  // --- Category CRUD ---
  openCreateCategory(): void {
    this.editingCatId.set(0);
    this.catImage.set('');
    this.catIcon.set('');
    this.catForm.reset({ name: '', returnWindowInDays: 0, nonReturnable: false, businessUnitId: 0 });
    this.catModalOpen.set(true);
  }

  openEditCategory(c: Category, event?: Event): void {
    event?.stopPropagation();
    this.editingCatId.set(c.categoryId);
    this.catImage.set(c.imageName);
    this.catIcon.set(c.iconImage);
    this.catForm.reset({
      name: c.name,
      returnWindowInDays: c.returnWindowInDays,
      nonReturnable: c.nonReturnable,
      businessUnitId: c.businessUnitId ?? 0,
    });
    this.catModalOpen.set(true);
  }

  saveCategory(): void {
    if (this.catForm.invalid) {
      this.catForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.catForm.getRawValue();
    this.service
      .saveCategory({
        categoryId: this.editingCatId(),
        companyId: 0,
        name: v.name,
        imageName: this.catImage(),
        iconImage: this.catIcon(),
        isActive: true,
        returnWindowInDays: Number(v.returnWindowInDays),
        nonReturnable: v.nonReturnable,
        businessUnitId: Number(v.businessUnitId) || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.catModalOpen.set(false);
          this.toast.success(this.editingCatId() ? 'Category updated.' : 'Category created.');
          this.loadCategories();
        },
        error: () => this.saving.set(false),
      });
  }

  toggleCategory(c: Category): void {
    this.service.toggleCategory(c.categoryId, !c.isActive).subscribe({
      next: () => {
        this.categories.update((list) =>
          list.map((x) => (x.categoryId === c.categoryId ? { ...x, isActive: !x.isActive } : x)),
        );
        this.toast.success(c.isActive ? 'Category hidden.' : 'Category visible.');
      },
    });
  }

  // --- Sub / Sub-sub CRUD (shared modal) ---
  openCreateSub(): void {
    this.editingSubId.set(0);
    this.subForm.reset({ subCategoryName: '', sortOrder: 0, returnWindowInDays: 0, nonReturnable: false, isActive: true });
    this.subModalOpen.set(true);
  }

  openEditSub(s: SubCategory): void {
    this.editingSubId.set(s.subCategoryId);
    this.subForm.reset({
      subCategoryName: s.subCategoryName,
      sortOrder: s.sortOrder,
      returnWindowInDays: s.returnWindowInDays,
      nonReturnable: s.nonReturnable,
      isActive: s.isActive,
    });
    this.subModalOpen.set(true);
  }

  saveSub(): void {
    if (this.subForm.invalid) {
      this.subForm.markAllAsTouched();
      return;
    }
    const cat = this.selectedCategory();
    if (!cat) return;
    const isSubSub = this.view() === 'subsubs';
    const parentSubId = isSubSub ? (this.selectedSub()?.subCategoryId ?? 0) : 0;
    this.saving.set(true);
    const v = this.subForm.getRawValue();
    this.service
      .saveSubCategory({
        subCategoryId: this.editingSubId(),
        categoryId: cat.categoryId,
        parentSubCategoryId: parentSubId,
        subCategoryName: v.subCategoryName,
        sortOrder: Number(v.sortOrder),
        isActive: v.isActive,
        returnWindowInDays: Number(v.returnWindowInDays),
        nonReturnable: v.nonReturnable,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.subModalOpen.set(false);
          this.toast.success('Saved.');
          if (isSubSub) this.reloadCurrentSubSubs();
          else this.reloadCurrentSubs();
        },
        error: () => this.saving.set(false),
      });
  }

  async deleteSub(s: SubCategory): Promise<void> {
    const isSubSub = this.view() === 'subsubs';
    const ok = await this.confirm.ask(`Delete "${s.subCategoryName}"?`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    this.service.deleteSubCategory(s.subCategoryId).subscribe({
      next: () => {
        this.toast.success('Deleted.');
        if (isSubSub) this.reloadCurrentSubSubs();
        else this.reloadCurrentSubs();
      },
    });
  }

  buName(id: number | null): string {
    return this.businessUnits().find((b) => b.businessUnitId === id)?.unitName ?? '';
  }

  // --- Options (category / sub / sub-sub level) ---
  openCategoryOptions(c: Category, event?: Event): void {
    event?.stopPropagation();
    this.optionsCategoryId.set(c.categoryId);
    this.optionsSubCategoryId.set(0);
    this.optionsContext.set(c.name);
    this.optionsOpen.set(true);
  }

  openSubOptions(s: SubCategory): void {
    this.optionsCategoryId.set(s.categoryId);
    this.optionsSubCategoryId.set(s.subCategoryId);
    this.optionsContext.set(s.subCategoryName);
    this.optionsOpen.set(true);
  }
}
