import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Select } from '../../../shared/ui/select/select';
import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ItemService } from './item.service';
import {
  ItemDetail,
  ItemPricing,
  NamedOption,
  SubCategoryOption,
  TaxOption,
} from './item.models';

@Component({
  selector: 'app-item-edit-page',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, Select, Checkbox, Tabs, ImageUpload],
  templateUrl: './item-edit.page.html',
})
export class ItemEditPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ItemService);
  private readonly toast = inject(ToastService);

  readonly itemId = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly tabs: TabItem[] = [
    { id: 'details', label: 'Details' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'media', label: 'Media' },
  ];
  readonly activeTab = signal('details');

  readonly brands = signal<NamedOption[]>([]);
  readonly categories = signal<NamedOption[]>([]);
  readonly subCategories = signal<SubCategoryOption[]>([]);
  readonly taxes = signal<TaxOption[]>([]);
  readonly itemCodeFormat = signal('');

  readonly pricing = signal<ItemPricing[]>([]);
  readonly media = signal<string[]>([]); // image paths

  readonly form = this.fb.nonNullable.group({
    itemName: ['', [Validators.required]],
    itemCode: [''],
    itemDescription: [''],
    brandId: [0, [Validators.required]],
    categoryId: [0, [Validators.required]],
    subCategoryId: [0],
    taxId: [0],
    hsn: [''],
    liveFromDate: [''],
    liveToDate: [''],
    itemSortOrderInCategory: [0],
    returnWindowInDays: [0],
    isActive: [true],
    isFeatureItem: [false],
    isSoldOut: [false],
    isSerialized: [false],
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    this.itemId.set(Number.isNaN(id) ? 0 : id);

    this.service.ddlLists().subscribe({
      next: (d) => {
        this.brands.set(d.brands);
        this.categories.set(d.categories);
        this.itemCodeFormat.set(d.itemCodeFormatName);
      },
    });
    this.service.taxes().subscribe({ next: (t) => this.taxes.set(t) });

    if (this.itemId()) {
      this.loadItem();
    } else {
      this.pricing.set([this.blankPricing()]);
    }
  }

  private blankPricing(): ItemPricing {
    return { itemPricingId: 0, mrp: 0, discount: 0, price: 0, cost: 0, startDate: '', endDate: '' };
  }

  loadItem(): void {
    this.loading.set(true);
    this.service.getItem(this.itemId()).subscribe({
      next: (item) => {
        this.form.reset({
          itemName: item.itemName,
          itemCode: item.itemCode,
          itemDescription: item.itemDescription,
          brandId: item.brandId,
          categoryId: item.categoryId,
          subCategoryId: item.subCategoryId,
          taxId: item.taxId,
          hsn: item.hsn,
          liveFromDate: item.liveFromDate,
          liveToDate: item.liveToDate,
          itemSortOrderInCategory: item.itemSortOrderInCategory,
          returnWindowInDays: item.returnWindowInDays ?? 0,
          isActive: item.isActive,
          isFeatureItem: item.isFeatureItem,
          isSoldOut: item.isSoldOut,
          isSerialized: item.isSerialized,
        });
        this.pricing.set(item.pricing.length ? item.pricing : [this.blankPricing()]);
        this.media.set(item.media.map((m) => m.imageFullPath));
        if (item.categoryId) this.loadSubCategories(item.categoryId);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onCategoryChange(id: number): void {
    this.form.controls.categoryId.setValue(Number(id));
    this.form.controls.subCategoryId.setValue(0);
    this.subCategories.set([]);
    if (id) this.loadSubCategories(Number(id));
  }

  private loadSubCategories(categoryId: number): void {
    this.service.subCategories(categoryId).subscribe({ next: (s) => this.subCategories.set(s) });
  }

  // --- Pricing rows ---
  addPricing(): void {
    this.pricing.update((list) => [...list, this.blankPricing()]);
  }

  removePricing(index: number): void {
    this.pricing.update((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  updatePricing(index: number, field: keyof ItemPricing, value: string | number): void {
    this.pricing.update((list) =>
      list.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  }

  // --- Media ---
  addMedia(url: string): void {
    if (url) this.media.update((list) => [...list, url]);
  }

  removeMedia(index: number): void {
    this.media.update((list) => list.filter((_, i) => i !== index));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.activeTab.set('details');
      this.toast.error('Fill in the required item details.');
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const payload: ItemDetail = {
      itemId: this.itemId(),
      brandId: Number(v.brandId),
      categoryId: Number(v.categoryId),
      subCategoryId: Number(v.subCategoryId),
      itemName: v.itemName,
      itemCode: v.itemCode,
      itemDescription: v.itemDescription,
      liveFromDate: v.liveFromDate,
      liveToDate: v.liveToDate,
      itemSortOrderInCategory: Number(v.itemSortOrderInCategory),
      isActive: v.isActive,
      isFeatureItem: v.isFeatureItem,
      isSoldOut: v.isSoldOut,
      isSerialized: v.isSerialized,
      taxId: Number(v.taxId),
      hsn: v.hsn,
      showAvailableQtyIfBelow: null,
      returnWindowInDays: Number(v.returnWindowInDays) || null,
      isReturnWindowDays: Number(v.returnWindowInDays) > 0,
      pricing: this.pricing().map((p) => ({
        ...p,
        mrp: Number(p.mrp),
        discount: Number(p.discount),
        price: Number(p.price),
        cost: Number(p.cost),
      })),
      media: [],
    };
    this.service.save(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.itemId() ? 'Item updated.' : 'Item created.');
        this.router.navigate(['/catalog/items']);
      },
      error: () => this.saving.set(false),
    });
  }
}
