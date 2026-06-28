import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';

import { Select } from '../../../shared/ui/select/select';
import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ItemContent } from './item-content';
import { VariantEditModal } from './variant-edit';
import { ItemService } from './item.service';
import {
  ItemDetail,
  ItemPricing,
  ItemVariantOptionSel,
  ItemVariantRow,
  NamedOption,
  SubCategoryOption,
  TaxOption,
  ItemPriceRange,
  ItemCustomField,
  StockTransaction,
  CustomFieldOption,
  ItemImage,
} from './item.models';

/** Local row for the Variants tab: an option with per-value selection. */
interface OptionRow {
  variantOptionId: number;
  optionName: string;
  isApplicable: boolean;
  isFilterable: boolean;
  values: {
    optionValueId: number; // category value id
    optionValueName: string;
    selected: boolean;
    savedValueId: number; // item's existing variantOptionValueId (0 if new)
  }[];
}

@Component({
  selector: 'app-item-edit-page',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, DecimalPipe, Select, Checkbox, Tabs, ImageUpload, ItemContent, VariantEditModal],
  templateUrl: './item-edit.page.html',
})
export class ItemEditPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ItemService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly itemId = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly activeTab = signal('details');
  // "Content" (tags/SEO/FAQ/similar) only applies to a saved item.
  readonly tabs = computed<TabItem[]>(() => {
    const base: TabItem[] = [
      { id: 'details', label: 'Details' },
      { id: 'pricing', label: 'Pricing' },
      { id: 'tiered-pricing', label: 'Tiered Pricing' },
      { id: 'variants', label: 'Variants' },
      { id: 'custom-fields', label: 'Custom Fields' },
      { id: 'media', label: 'Media' },
    ];
    if (this.itemId()) base.push({ id: 'content', label: 'Content' });
    return base;
  });

  readonly brands = signal<NamedOption[]>([]);
  readonly categories = signal<NamedOption[]>([]);
  readonly allSubCategories = signal<SubCategoryOption[]>([]);
  readonly subCategories = computed(() => this.allSubCategories().filter((s) => !s.parentSubCategoryId));
  readonly families = computed(() => {
    const parentId = this.selectedSubCategoryId();
    return this.allSubCategories().filter((s) => s.parentSubCategoryId === parentId);
  });
  readonly selectedSubCategoryId = signal<number>(0);
  readonly selectedFamilyId = signal<number>(0);
  readonly taxes = signal<TaxOption[]>([]);
  readonly itemCodeFormat = signal('');
  readonly currency = signal('');

  readonly pricing = signal<ItemPricing[]>([]);
  readonly media = signal<ItemImage[]>([]);
  newImagesToLink: string[] = [];

  // Tiered Pricing (Price Range)
  readonly isPriceRange = signal(false);
  readonly priceRanges = signal<ItemPriceRange[]>([]);

  // Custom Fields
  readonly customFields = signal<ItemCustomField[]>([]);

  // Stock History
  readonly stockTransactions = signal<StockTransaction[]>([]);

  // Variant options (per-value selection merged from category options + item's saved selection)
  readonly optionRows = signal<OptionRow[]>([]);
  readonly loadingOptions = signal(false);
  private itemSavedOptions: ItemVariantOptionSel[] = [];

  // Generated variants of the item
  readonly variants = signal<ItemVariantRow[]>([]);
  readonly loadingVariants = signal(false);
  // Variant add/edit modal
  readonly variantModalOpen = signal(false);
  readonly editingVariantId = signal(0);

  readonly form = this.fb.nonNullable.group({
    itemName: ['', [Validators.required]],
    itemCode: [''],
    itemDescription: [''],
    brandId: [0, [Validators.required]],
    categoryId: [0, [Validators.required]],
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
        this.currency.set(d.currency);
      },
    });
    this.service.taxes().subscribe({ next: (t) => this.taxes.set(t) });

    if (this.itemId()) {
      this.loadItem();
    } else {
      this.pricing.set([this.blankPricing()]);
      this.priceRanges.set([this.blankPriceRange()]);
      this.service.customFieldList(0).subscribe({ next: (cf) => this.customFields.set(cf) });
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
        this.media.set(item.media);
        this.itemSavedOptions = item.variantOptions ?? [];
        this.isPriceRange.set(item.isPriceRange ?? false);
        this.priceRanges.set(item.priceRanges?.length ? item.priceRanges : [this.blankPriceRange()]);
        this.service.customFieldList(this.itemId()).subscribe({ next: (cf) => this.customFields.set(cf) });
        this.service.stockTransactions(this.itemId()).subscribe({ next: (st) => this.stockTransactions.set(st) });
        if (item.categoryId) {
          this.loadSubCategories(item.categoryId, item.subCategoryId);
          this.loadVariantOptions(item.categoryId);
        }
        this.loadVariants();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onCategoryChange(id: number): void {
    this.form.controls.categoryId.setValue(Number(id));
    this.allSubCategories.set([]);
    this.selectedSubCategoryId.set(0);
    this.selectedFamilyId.set(0);
    // category change replaces the available variant options; drop saved selection
    this.itemSavedOptions = [];
    this.optionRows.set([]);
    if (id) {
      this.loadSubCategories(Number(id));
      this.loadVariantOptions(Number(id));
    }
  }

  onSubCategoryChange(id: number): void {
    this.selectedSubCategoryId.set(Number(id));
    this.selectedFamilyId.set(0);
  }

  onFamilyChange(id: number): void {
    this.selectedFamilyId.set(Number(id));
  }

  private loadSubCategories(categoryId: number, activeSubCategoryId: number = 0): void {
    this.service.subCategories(categoryId).subscribe({
      next: (s) => {
        this.allSubCategories.set(s);
        if (activeSubCategoryId) {
          const match = s.find((x) => x.id === activeSubCategoryId);
          if (match) {
            if (match.parentSubCategoryId) {
              this.selectedSubCategoryId.set(match.parentSubCategoryId);
              this.selectedFamilyId.set(activeSubCategoryId);
            } else {
              this.selectedSubCategoryId.set(activeSubCategoryId);
              this.selectedFamilyId.set(0);
            }
          } else {
            this.selectedSubCategoryId.set(0);
            this.selectedFamilyId.set(0);
          }
        } else {
          this.selectedSubCategoryId.set(0);
          this.selectedFamilyId.set(0);
        }
      },
    });
  }

  /** Load the category's variant options and merge the item's saved selection. */
  private loadVariantOptions(categoryId: number): void {
    this.loadingOptions.set(true);
    this.service.categoryVariantOptions(categoryId).subscribe({
      next: (available) => {
        const rows: OptionRow[] = available.map((opt) => {
          // match the item's saved option by id or name (the .NET matches by OptionName)
          const saved = this.itemSavedOptions.find(
            (s) =>
              s.variantOptionId === opt.variantOptionId ||
              s.variantName?.toLowerCase() === opt.optionName?.toLowerCase(),
          );
          // selected values are matched by NAME (item value text === category value name)
          const savedByName = new Map(
            (saved?.selectedValues ?? []).map((v) => [v.optionValue.trim().toLowerCase(), v]),
          );
          return {
            variantOptionId: opt.variantOptionId,
            optionName: opt.optionName,
            isApplicable: saved ? saved.isApplicable : false,
            isFilterable: saved ? saved.isFilterable : false,
            values: opt.optionValues.map((v) => {
              const match = savedByName.get(v.optionValueName.trim().toLowerCase());
              return {
                optionValueId: v.optionValueId,
                optionValueName: v.optionValueName,
                selected: !!match,
                savedValueId: match?.variantOptionValueId ?? 0,
              };
            }),
          };
        });
        this.optionRows.set(rows);
        this.loadingOptions.set(false);
      },
      error: () => this.loadingOptions.set(false),
    });
  }

  loadVariants(): void {
    if (!this.itemId()) return;
    this.loadingVariants.set(true);
    this.service.variants(this.itemId()).subscribe({
      next: (v) => {
        this.variants.set(v);
        this.loadingVariants.set(false);
      },
      error: () => this.loadingVariants.set(false),
    });
  }

  openAddVariant(): void {
    this.editingVariantId.set(0);
    this.variantModalOpen.set(true);
  }

  openEditVariant(v: ItemVariantRow): void {
    this.editingVariantId.set(v.itemVariantId);
    this.variantModalOpen.set(true);
  }

  onVariantSaved(): void {
    this.variantModalOpen.set(false);
    this.loadVariants();
  }

  async deleteVariant(v: ItemVariantRow): Promise<void> {
    if (!(await this.confirm.ask(`Delete variant "${v.itemVariantName}"?`, { confirmLabel: 'Delete', danger: true }))) return;
    this.service.deleteVariant(v.itemVariantId, this.itemId()).subscribe({
      next: () => {
        this.toast.success('Variant deleted.');
        this.loadVariants();
      },
    });
  }

  toggleOptionApplicable(optionId: number, on: boolean): void {
    this.optionRows.update((rows) =>
      rows.map((r) => (r.variantOptionId === optionId ? { ...r, isApplicable: on } : r)),
    );
  }

  toggleOptionFilterable(optionId: number, on: boolean): void {
    this.optionRows.update((rows) =>
      rows.map((r) => (r.variantOptionId === optionId ? { ...r, isFilterable: on } : r)),
    );
  }

  toggleOptionValue(optionId: number, valueId: number): void {
    this.optionRows.update((rows) =>
      rows.map((r) =>
        r.variantOptionId === optionId
          ? {
              ...r,
              values: r.values.map((v) =>
                v.optionValueId === valueId ? { ...v, selected: !v.selected } : v,
              ),
            }
          : r,
      ),
    );
  }

  // --- Tiered Pricing (Price Range) ---
  private blankPriceRange(): ItemPriceRange {
    return { itemPriceChartId: 0, fromQty: 1, toQty: 1, price: 0, fromDate: '', toDate: '' };
  }

  addPriceRange(): void {
    this.priceRanges.update((list) => [...list, this.blankPriceRange()]);
  }

  removePriceRange(index: number): void {
    this.priceRanges.update((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  updatePriceRange(index: number, field: keyof ItemPriceRange, value: string | number): void {
    this.priceRanges.update((list) =>
      list.map((pr, i) => (i === index ? { ...pr, [field]: value } : pr))
    );
  }

  // --- Dynamic Custom Fields ---
  updateCustomFieldIsShow(index: number, isShow: boolean): void {
    this.customFields.update((list) =>
      list.map((c, i) => (i === index ? { ...c, isShow } : c))
    );
  }

  updateCustomFieldValue(index: number, value: string): void {
    this.customFields.update((list) =>
      list.map((c, i) => (i === index ? { ...c, fieldValue: value } : c))
    );
  }

  updateCustomFieldOptionChecked(fieldIdx: number, optIdx: number, checked: boolean): void {
    this.customFields.update((list) =>
      list.map((c, i) => {
        if (i !== fieldIdx) return c;
        const updatedFields = c.fields.map((f: CustomFieldOption, j: number) =>
          j === optIdx ? { ...f, selected: checked } : f
        );
        return { ...c, fields: updatedFields };
      })
    );
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
    if (!url) return;
    const lastSlashIdx = url.lastIndexOf('/');
    const filePath = url.slice(0, lastSlashIdx + 1);
    const fileName = url.slice(lastSlashIdx + 1);

    if (this.itemId() > 0) {
      this.service
        .addImage({
          AlterText: this.form.controls.itemName.value || 'Item Image',
          Name: fileName,
          Medium: fileName,
          Thumbnail: fileName,
          Description: fileName,
          FilePath: filePath,
          Title: fileName,
          EntityType: 'Item',
          EntitySubType: 'Image',
          Height: 0,
          Width: 0,
          CompanyId: this.service['auth'].companyId(),
          IsActive: true,
          ExternalEntityId: this.itemId(),
          IsAllocated: true,
        })
        .subscribe({
          next: (res) => {
            const imageId = Number(res?.data?.imageId ?? 0);
            this.media.update((list) => [...list, { imageId, imageFullPath: url }]);
            this.toast.success('Image linked to item.');
          },
          error: () => this.toast.error('Image uploaded but failed to link to item.'),
        });
    } else {
      this.newImagesToLink.push(url);
      this.media.update((list) => [...list, { imageId: 0, imageFullPath: url }]);
    }
  }

  removeMedia(img: ItemImage): void {
    if (img.imageId > 0) {
      this.service.deleteImage(img.imageId).subscribe({
        next: () => {
          this.media.update((list) => list.filter((m) => m.imageId !== img.imageId));
          this.toast.success('Image unlinked.');
        },
        error: () => this.toast.error('Failed to delete image.'),
      });
    } else {
      this.newImagesToLink = this.newImagesToLink.filter((url) => url !== img.imageFullPath);
      this.media.update((list) => list.filter((m) => m.imageFullPath !== img.imageFullPath));
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.activeTab.set('details');
      this.toast.error('Fill in the required item details (see Details tab).');
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const payload: ItemDetail = {
      itemId: this.itemId(),
      brandId: Number(v.brandId),
      categoryId: Number(v.categoryId),
      subCategoryId: this.selectedFamilyId() || this.selectedSubCategoryId() || 0,
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
      pricing: this.pricing().map((p) => {
        const today = new Date();
        const startDate = p.startDate || today.toISOString().slice(0, 10);
        const endDate = p.endDate || new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
        return {
          ...p,
          mrp: Number(p.mrp),
          discount: Number(p.discount),
          price: Number(p.price),
          cost: Number(p.cost),
          startDate,
          endDate,
        };
      }),
      media: [],
      variantOptions: this.optionRows().map((r, idx) => ({
        variantOptionId: r.variantOptionId,
        variantName: r.optionName,
        defaultDisplayOrder: idx + 1,
        isApplicable: r.isApplicable,
        isFilterable: r.isFilterable,
        selectedValues: r.values
          .filter((v) => v.selected)
          .map((v, i) => ({
            optionValueId: v.optionValueId,
            variantOptionValueId: v.savedValueId,
            optionValue: v.optionValueName,
            displayOrder: i + 1,
            colorCode: '',
          })),
      })),
      isPriceRange: this.isPriceRange(),
      priceRanges: this.priceRanges().map((pr) => ({
        ...pr,
        fromQty: Number(pr.fromQty),
        toQty: Number(pr.toQty),
        price: Number(pr.price),
      })),
      customFields: this.customFields(),
    };
    this.service.save(payload).subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (res && res.status === false) {
          this.toast.error(res.message || 'Could not save the item. Please try again.');
          return;
        }
        const data = res?.data as Record<string, unknown> | null;
        const savedId = Number(data?.['itemId'] ?? data?.['ItemId'] ?? data?.['Itemid'] ?? data?.['itemid'] ?? 0);

        if (savedId > 0) {
          if (!this.itemId() && this.newImagesToLink.length > 0) {
            this.linkNewImages(savedId);
          } else {
            this.toast.success(this.itemId() ? 'Item updated.' : 'Item created.');
            this.router.navigate(['/catalog/items']);
          }
        } else if (savedId === -1) {
          this.toast.error('An item with this name already exists in this brand.');
        } else if (savedId === 0) {
          this.toast.error('Item code "' + this.form.controls.itemCode.value + '" already exists. Use a unique item code.');
        } else {
          this.toast.error('Could not save the item. Please try again.');
        }
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Could not save the item. Please try again.');
      },
    });
  }

  linkNewImages(itemId: number): void {
    const obs = this.newImagesToLink.map((url) => {
      const lastSlashIdx = url.lastIndexOf('/');
      const filePath = url.slice(0, lastSlashIdx + 1);
      const fileName = url.slice(lastSlashIdx + 1);
      return this.service.addImage({
        AlterText: this.form.controls.itemName.value || 'Item Image',
        Name: fileName,
        Medium: fileName,
        Thumbnail: fileName,
        Description: fileName,
        FilePath: filePath,
        Title: fileName,
        EntityType: 'Item',
        EntitySubType: 'Image',
        Height: 0,
        Width: 0,
        CompanyId: this.service['auth'].companyId(),
        IsActive: true,
        ExternalEntityId: itemId,
        IsAllocated: true,
      });
    });
    forkJoin(obs).subscribe({
      next: () => {
        this.toast.success('Item created and images linked.');
        this.newImagesToLink = [];
        this.router.navigate(['/catalog/items']);
      },
      error: () => {
        this.toast.error('Item saved but some images failed to link.');
        this.newImagesToLink = [];
        this.router.navigate(['/catalog/items']);
      },
    });
  }
}
