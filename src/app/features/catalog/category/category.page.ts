import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { TooltipService } from '../../../shared/ui/tooltip.service';

import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { Select } from '../../../shared/ui/select/select';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { CategoryService } from './category.service';
import { CategoryOptions } from './category-options';
import { BusinessUnitOption, Category, SubCategory, TreeNode } from './category.models';

@Component({
  selector: 'app-category-page',
  imports: [ReactiveFormsModule, FormsModule, UpperCasePipe, Checkbox, Select, ImageUpload, CategoryOptions],
  templateUrl: './category.page.html',
})
export class CategoryPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CategoryService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  public readonly tooltip = inject(TooltipService);

  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly treeNodes = signal<TreeNode[]>([]);
  readonly businessUnits = signal<BusinessUnitOption[]>([]);

  readonly selectedNode = signal<TreeNode | null>(null);
  readonly parentNode = signal<TreeNode | null>(null);
  readonly createMode = signal<'root' | 'child' | null>(null);

  readonly search = signal('');

  // Options modal (works at category / sub / sub-sub level)
  readonly optionsOpen = signal(false);
  readonly optionsCategoryId = signal(0);
  readonly optionsSubCategoryId = signal(0);
  readonly optionsContext = signal('');

  // Category image uploaders
  readonly catImage = signal(''); // banner
  readonly catIcon = signal(''); // icon/logo

  readonly catForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    returnWindowInDays: [0],
    nonReturnable: [false],
    businessUnitId: [0],
  });

  readonly subForm = this.fb.nonNullable.group({
    subCategoryName: ['', [Validators.required]],
    sortOrder: [0],
    returnWindowInDays: [0],
    nonReturnable: [false],
    isActive: [true],
  });

  readonly filteredTreeNodes = computed(() => {
    const q = this.search().toLowerCase().trim();
    const list = this.treeNodes();
    if (!q) return list;
    return list.filter((n) => n.name.toLowerCase().includes(q));
  });

  constructor() {
    this.loadCategories();
    this.service.businessUnits().subscribe({ next: (b) => this.businessUnits.set(b) });
  }

  // --- Tree Operations ---
  loadCategories(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (cats) => {
        const nodes = cats.map((c) => this.mapCategoryToNode(c));
        this.treeNodes.set(nodes);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private mapCategoryToNode(c: Category): TreeNode {
    return {
      id: `cat-${c.categoryId}`,
      type: 'category',
      name: c.name || '',
      isActive: c.isActive,
      returnWindowInDays: c.returnWindowInDays,
      nonReturnable: c.nonReturnable,
      businessUnitId: c.businessUnitId,
      imageName: c.imageName,
      iconImage: c.iconImage,
      categoryId: c.categoryId,
      expanded: false,
      loaded: false,
      loading: false,
      children: [],
    };
  }

  private mapSubToNode(s: SubCategory, isSubSub = false): TreeNode {
    return {
      id: isSubSub ? `subsub-${s.subCategoryId}` : `sub-${s.subCategoryId}`,
      type: isSubSub ? 'subsubcategory' : 'subcategory',
      name: s.subCategoryName || '',
      isActive: s.isActive,
      returnWindowInDays: s.returnWindowInDays,
      nonReturnable: s.nonReturnable,
      sortOrder: s.sortOrder,
      categoryId: s.categoryId,
      subCategoryId: s.subCategoryId,
      parentSubCategoryId: s.parentSubCategoryId,
      expanded: false,
      loaded: false,
      loading: false,
      children: [],
    };
  }

  toggleExpand(node: TreeNode, event?: Event): void {
    event?.stopPropagation();
    if (node.type === 'subsubcategory') return;

    if (node.expanded) {
      node.expanded = false;
      return;
    }

    if (node.loaded) {
      node.expanded = true;
      return;
    }

    node.loading = true;
    if (node.type === 'category') {
      this.service.subCategories(node.categoryId).subscribe({
        next: (subs) => {
          node.children = subs.map((s) => this.mapSubToNode(s, false));
          node.loaded = true;
          node.loading = false;
          node.expanded = true;
          this.treeNodes.update((list) => [...list]);
        },
        error: () => {
          node.loading = false;
        },
      });
    } else if (node.type === 'subcategory') {
      this.service.subSubCategories(node.subCategoryId!).subscribe({
        next: (subsubs) => {
          node.children = subsubs.map((s) => this.mapSubToNode(s, true));
          node.loaded = true;
          node.loading = false;
          node.expanded = true;
          this.treeNodes.update((list) => [...list]);
        },
        error: () => {
          node.loading = false;
        },
      });
    }
  }

  selectNode(node: TreeNode): void {
    this.createMode.set(null);
    this.parentNode.set(null);
    this.selectedNode.set(node);

    if (node.type === 'category') {
      this.catImage.set(node.imageName || '');
      this.catIcon.set(node.iconImage || '');
      this.catForm.reset({
        name: node.name,
        returnWindowInDays: node.returnWindowInDays,
        nonReturnable: node.nonReturnable,
        businessUnitId: node.businessUnitId ?? 0,
      });
    } else {
      this.subForm.reset({
        subCategoryName: node.name,
        sortOrder: node.sortOrder ?? 0,
        returnWindowInDays: node.returnWindowInDays,
        nonReturnable: node.nonReturnable,
        isActive: node.isActive,
      });
    }
  }

  // --- CRUD Initiators ---
  openCreateCategory(): void {
    this.selectedNode.set(null);
    this.parentNode.set(null);
    this.createMode.set('root');
    this.catImage.set('');
    this.catIcon.set('');
    this.catForm.reset({ name: '', returnWindowInDays: 0, nonReturnable: false, businessUnitId: 0 });
  }

  addChildNode(parent: TreeNode, event?: Event): void {
    event?.stopPropagation();
    this.selectedNode.set(null);
    this.parentNode.set(parent);
    this.createMode.set('child');
    this.subForm.reset({
      subCategoryName: '',
      sortOrder: 0,
      returnWindowInDays: parent.returnWindowInDays,
      nonReturnable: parent.nonReturnable,
      isActive: true,
    });

    if (!parent.expanded) {
      this.toggleExpand(parent);
    }
  }

  cancelSelection(): void {
    this.selectedNode.set(null);
    this.parentNode.set(null);
    this.createMode.set(null);
  }

  // --- Category CRUD Operations ---
  saveCategory(): void {
    if (this.catForm.invalid) {
      this.catForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.catForm.getRawValue();
    const catId = this.createMode() === 'root' ? 0 : this.selectedNode()!.categoryId;

    this.service
      .saveCategory({
        categoryId: catId,
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
          this.toast.success(catId ? 'Category updated.' : 'Category created.');
          this.cancelSelection();
          this.loadCategories();
        },
        error: () => this.saving.set(false),
      });
  }

  toggleCategoryNode(node: TreeNode, event?: Event): void {
    event?.stopPropagation();
    this.service.toggleCategory(node.categoryId, !node.isActive).subscribe({
      next: () => {
        node.isActive = !node.isActive;
        this.treeNodes.update((list) => [...list]);
        this.toast.success(node.isActive ? 'Category visible.' : 'Category hidden.');
      },
    });
  }

  // --- Sub / Sub-sub CRUD Operations ---
  saveSub(): void {
    if (this.subForm.invalid) {
      this.subForm.markAllAsTouched();
      return;
    }
    
    this.saving.set(true);
    const v = this.subForm.getRawValue();
    
    let catId = 0;
    let parentSubId = 0;
    let subId = 0;

    if (this.createMode() === 'child') {
      const parent = this.parentNode()!;
      catId = parent.categoryId;
      parentSubId = parent.type === 'subcategory' ? parent.subCategoryId! : 0;
      subId = 0;
    } else {
      const selected = this.selectedNode()!;
      catId = selected.categoryId;
      parentSubId = selected.parentSubCategoryId ?? 0;
      subId = selected.subCategoryId!;
    }

    this.service
      .saveSubCategory({
        subCategoryId: subId,
        categoryId: catId,
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
          this.toast.success('Saved.');
          
          if (this.createMode() === 'child') {
            const parent = this.parentNode()!;
            this.refreshNodeChildren(parent);
          } else {
            const selected = this.selectedNode()!;
            this.refreshParentOfNode(selected);
          }
          
          this.cancelSelection();
        },
        error: () => this.saving.set(false),
      });
  }

  async deleteNode(node: TreeNode, event?: Event): Promise<void> {
    event?.stopPropagation();
    const ok = await this.confirm.ask(`Delete "${node.name}"?`, { confirmLabel: 'Delete', danger: true });
    if (!ok) return;

    if (node.type === 'category') {
      return; // Root categories can only be hidden in this system
    }

    this.service.deleteSubCategory(node.subCategoryId!).subscribe({
      next: () => {
        this.toast.success('Deleted.');
        this.refreshParentOfNode(node);
        this.cancelSelection();
      },
    });
  }

  // --- Helper Methods ---
  buName(id: number | null): string {
    return this.businessUnits().find((b) => b.businessUnitId === id)?.unitName ?? '';
  }

  // --- Options (category / sub / sub-sub level) ---
  openCategoryOptions(node: TreeNode, event?: Event): void {
    event?.stopPropagation();
    this.optionsCategoryId.set(node.categoryId);
    this.optionsSubCategoryId.set(0);
    this.optionsContext.set(node.name);
    this.optionsOpen.set(true);
  }

  openSubOptions(node: TreeNode): void {
    this.optionsCategoryId.set(node.categoryId);
    this.optionsSubCategoryId.set(node.subCategoryId!);
    this.optionsContext.set(node.name);
    this.optionsOpen.set(true);
  }

  private refreshNodeChildren(node: TreeNode): void {
    if (node.type === 'category') {
      this.service.subCategories(node.categoryId).subscribe({
        next: (subs) => {
          node.children = subs.map((s) => this.mapSubToNode(s, false));
          node.loaded = true;
          this.treeNodes.update((list) => [...list]);
        },
      });
    } else if (node.type === 'subcategory') {
      this.service.subSubCategories(node.subCategoryId!).subscribe({
        next: (subsubs) => {
          node.children = subsubs.map((s) => this.mapSubToNode(s, true));
          node.loaded = true;
          this.treeNodes.update((list) => [...list]);
        },
      });
    }
  }

  private refreshParentOfNode(node: TreeNode): void {
    if (node.type === 'category') {
      this.loadCategories();
      return;
    }

    const parentNode = this.findParentNodeInTree(this.treeNodes(), node);
    if (parentNode) {
      this.refreshNodeChildren(parentNode);
    } else {
      this.loadCategories();
    }
  }

  private findParentNodeInTree(nodes: TreeNode[], target: TreeNode): TreeNode | null {
    for (const n of nodes) {
      if (target.type === 'subcategory' && n.type === 'category' && n.categoryId === target.categoryId) {
        return n;
      }
      if (target.type === 'subsubcategory' && n.type === 'subcategory' && n.subCategoryId === target.parentSubCategoryId) {
        return n;
      }
      const found = this.findParentNodeInTree(n.children, target);
      if (found) return found;
    }
    return null;
  }
}
