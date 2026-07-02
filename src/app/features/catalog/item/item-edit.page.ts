import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of, Observable, map, filter, take } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';

import { Select } from '../../../shared/ui/select/select';
import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { DatePicker } from '../../../shared/ui/date-picker/date-picker';
import { ImageUploadService } from '../../../core/api/image-upload.service';
import { TooltipService } from '../../../shared/ui/tooltip.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ItemContent } from './item-content';
import { WysiwygEditor } from '../../../shared/ui/wysiwyg-editor/wysiwyg-editor';
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
  /** Item-level attribute (option NOT applied on variant) → values are single-select; otherwise multi-select. */
  singleSelect: boolean;
  values: {
    optionValueId: number; // category value id
    optionValueName: string;
    selected: boolean;
    savedValueId: number; // item's existing variantOptionValueId (0 if new)
  }[];
}

@Component({
  selector: 'app-item-edit-page',
  imports: [ReactiveFormsModule, FormsModule, RouterLink, DecimalPipe, Select, Checkbox, ItemContent, VariantEditModal, WysiwygEditor, DatePicker],
  templateUrl: './item-edit.page.html',
})
export class ItemEditPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ItemService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly uploader = inject(ImageUploadService);
  public readonly tooltip = inject(TooltipService);

  readonly itemId = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly localPreviews = signal<{ id: string; file: File; dataUrl: string; progress?: number; uploading?: boolean }[]>([]);

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
  readonly itemCodeFormatId = signal(0);
  readonly itemCount = signal(0);
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
  readonly allVariants = signal<ItemVariantRow[]>([]);
  readonly loadingVariants = signal(false);
  // Variant add/edit modal
  readonly variantModalOpen = signal(false);
  readonly editingVariantId = signal(0);

  // Variant filtering
  readonly variantFilters = signal<Record<number, number>>({});

  // Variant image mapping
  readonly showImageMapModal = signal(false);
  readonly selectedVariantForImage = signal<ItemVariantRow | null>(null);
  readonly variantImageSelection = signal<number[]>([]);
  readonly savingImageMapping = signal(false);



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
    returnWindowInDays: [{ value: 0, disabled: false }],
    isReturnWindowDays: [false],
    isActive: [true],
    isFeatureItem: [false],
    isSoldOut: [false],
    isSerialized: [false],
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    this.itemId.set(Number.isNaN(id) ? 0 : id);

    this.form.controls.isReturnWindowDays.valueChanges.subscribe((checked) => {
      const ctrl = this.form.controls.returnWindowInDays;
      if (checked) {
        ctrl.setValue(0);
        ctrl.disable();
      } else {
        ctrl.enable();
      }
    });

    this.service.ddlLists().subscribe({
      next: (d) => {
        this.brands.set(d.brands);
        this.categories.set(d.categories);
        this.itemCodeFormat.set(d.itemCodeFormatName);
        this.itemCodeFormatId.set(d.itemCodeFormatId);
        this.itemCount.set(d.itemCount);
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
          returnWindowInDays: { value: item.returnWindowInDays ?? 0, disabled: !!item.isReturnWindowDays },
          isReturnWindowDays: !!item.isReturnWindowDays,
          isActive: item.isActive,
          isFeatureItem: item.isFeatureItem,
          isSoldOut: item.isSoldOut,
          isSerialized: item.isSerialized,
        });
        this.pricing.set(item.pricing.length ? item.pricing : [this.blankPricing()]);
        this.service.getItemWiseImageList(this.itemId()).subscribe({
          next: (images) => this.media.set(images),
          error: () => this.media.set(item.media),
        });
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
    } else {
      this.generateItemCode();
    }
  }

  onSubCategoryChange(id: number): void {
    this.selectedSubCategoryId.set(Number(id));
    this.selectedFamilyId.set(0);
    this.generateItemCode();
  }

  onFamilyChange(id: number): void {
    this.selectedFamilyId.set(Number(id));
    this.generateItemCode();
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
        this.generateItemCode();
      },
    });
  }

  private generateItemCode(): void {
    if (this.itemId()) return; // Only auto-generate for new items
    const catId = this.form.controls.categoryId.value;
    if (!catId) {
      this.form.controls.itemCode.setValue('');
      return;
    }

    const catObj = this.categories().find((c) => c.id === catId);
    const catText = catObj ? catObj.name : '';
    const formattedCategoryText = catText.substring(0, 2).toUpperCase();

    const subCatId = this.selectedFamilyId() || this.selectedSubCategoryId() || 0;
    const subCatObj = this.allSubCategories().find((s) => s.id === subCatId);
    const subCatText = subCatObj ? subCatObj.name : '';
    const formattedSubCategoryText = subCatText.substring(0, 2).toUpperCase();

    const itemCount = this.itemCount();
    const formatId = this.itemCodeFormatId();

    let generatedCode = '';
    if (formatId === 2) {
      if (subCatId) {
        generatedCode = `${formattedCategoryText}-${formattedSubCategoryText}-${itemCount}`;
      } else {
        generatedCode = `${formattedCategoryText}-${itemCount}`;
      }
    } else {
      // formats 3 and others
      const currentYear = new Date().getFullYear();
      const formattedYear = currentYear.toString().substring(2, 4);
      if (subCatId) {
        generatedCode = `${formattedCategoryText}-${formattedSubCategoryText}-${formattedYear}-${itemCount}`;
      } else {
        generatedCode = `${formattedCategoryText}-${formattedYear}-${itemCount}`;
      }
    }

    this.form.controls.itemCode.setValue(generatedCode);
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
          const singleSelect = !opt.appliedOnVariant;
          let seenSelected = false;
          return {
            variantOptionId: opt.variantOptionId,
            optionName: opt.optionName,
            isApplicable: saved ? saved.isApplicable : false,
            isFilterable: saved ? saved.isFilterable : false,
            singleSelect,
            values: opt.optionValues.map((v) => {
              const match = savedByName.get(v.optionValueName.trim().toLowerCase());
              // Item-level (single-select) options keep only the first saved value.
              let selected = !!match;
              if (selected && singleSelect) {
                if (seenSelected) selected = false;
                else seenSelected = true;
              }
              return {
                optionValueId: v.optionValueId,
                optionValueName: v.optionValueName,
                selected,
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
        this.allVariants.set(v);
        this.applyVariantFilters();
        this.loadingVariants.set(false);
      },
      error: () => this.loadingVariants.set(false),
    });
  }

  async discard(): Promise<void> {
    if (this.form.dirty) {
      if (!(await this.confirm.ask('Discard unsaved changes?', { confirmLabel: 'Discard', danger: true }))) return;
    }
    this.router.navigate(['/catalog/items']);
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
      rows.map((r) => {
        if (r.variantOptionId !== optionId) return r;
        return {
          ...r,
          values: r.values.map((v) => {
            if (v.optionValueId === valueId) return { ...v, selected: !v.selected };
            // Single-select (item-level) options: picking one clears the others.
            return r.singleSelect ? { ...v, selected: false } : v;
          }),
        };
      }),
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
    let numVal = Number(value) || 0;
    this.pricing.update((list) =>
      list.map((p, i) => {
        if (i !== index) return p;

        let updated = { ...p, [field]: value };

        const mrp = Number(field === 'mrp' ? numVal : updated.mrp) || 0;
        let discount = Number(field === 'discount' ? numVal : updated.discount) || 0;
        let price = Number(field === 'price' ? numVal : updated.price) || 0;

        if (field === 'mrp') {
          if (discount > 0) {
            price = mrp - (mrp * discount) / 100;
            updated.price = Number(price.toFixed(2));
          } else {
            updated.price = mrp;
          }
        } else if (field === 'discount') {
          if (discount > 100) {
            discount = 100;
            updated.discount = 100;
          } else if (discount < 0) {
            discount = 0;
            updated.discount = 0;
          }
          price = mrp - (mrp * discount) / 100;
          updated.price = Number(price.toFixed(2));
        } else if (field === 'price') {
          if (price > mrp && mrp > 0) {
            price = mrp;
            updated.price = mrp;
          }
          if (mrp > 0) {
            discount = ((mrp - price) / mrp) * 100;
            updated.discount = Number(discount.toFixed(2));
          }
        }

        return updated;
      }),
    );
  }

  // --- Media ---
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        this.toast.error(`"${file.name}" is not an image file.`);
        continue;
      }

      const id = Math.random().toString(36).substring(2);
      const reader = new FileReader();
      reader.onload = () => {
        this.localPreviews.update((list) => [
          ...list,
          { id, file, dataUrl: reader.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  removeLocalPreview(id: string): void {
    this.localPreviews.update((list) => list.filter((p) => p.id !== id));
  }

  clearUploadsState(): void {
    this.localPreviews.set([]);
    this.uploading.set(false);
    this.uploadProgress.set(0);
  }

  uploadFile(file: File): Observable<string> {
    return this.uploader.upload(file, { entityType: 'Item' }).pipe(
      map((progress) => (progress.done ? progress.url || '' : '')),
      filter((url): url is string => !!url),
      take(1)
    );
  }

  uploadPendingImage(previewId: string): void {
    const list = this.localPreviews();
    const item = list.find((p) => p.id === previewId);
    if (!item || item.uploading) return;

    this.localPreviews.update((curr) =>
      curr.map((p) => (p.id === previewId ? { ...p, uploading: true, progress: 10 } : p))
    );

    this.uploader.upload(item.file, { entityType: 'Item' }).subscribe({
      next: (p) => {
        this.localPreviews.update((curr) =>
          curr.map((x) => (x.id === previewId ? { ...x, progress: p.progress } : x))
        );

        if (p.done) {
          if (p.url) {
            this.linkUploadedImage(p.url, previewId);
          } else {
            this.toast.error('Upload finished but no URL was returned.');
            this.resetPreviewState(previewId);
          }
        }
      },
      error: (err) => {
        console.error('Individual image upload failed:', err);
        this.toast.error('Image upload failed.');
        this.resetPreviewState(previewId);
      },
    });
  }

  resetPreviewState(previewId: string): void {
    this.localPreviews.update((curr) =>
      curr.map((p) => (p.id === previewId ? { ...p, uploading: false, progress: 0 } : p))
    );
  }

  linkUploadedImage(url: string, previewId: string): void {
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
            this.localPreviews.update((list) => list.filter((p) => p.id !== previewId));
            this.toast.success('Image uploaded and linked.');
          },
          error: () => {
            this.toast.error('Image uploaded but failed to link to item.');
            this.resetPreviewState(previewId);
          },
        });
    } else {
      this.newImagesToLink.push(url);
      this.media.update((list) => [...list, { imageId: 0, imageFullPath: url }]);
      this.localPreviews.update((list) => list.filter((p) => p.id !== previewId));
      this.toast.success('Image uploaded and queued.');
    }
  }

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
      this.toast.error('Fill in the required item details.');
      return;
    }

    if (this.localPreviews().length > 0) {
      this.saving.set(true);
      this.uploading.set(true);
      this.uploadProgress.set(10);
      const files = this.localPreviews().map((p) => p.file);
      const uploadObs = files.map((file) => this.uploadFile(file));

      forkJoin(uploadObs).subscribe({
        next: (urls) => {
          this.uploadProgress.set(100);
          if (this.itemId() > 0) {
            // Existing item: link them to DB immediately
            const linkObs = urls.map((url) => {
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
                ExternalEntityId: this.itemId(),
                IsAllocated: true,
              });
            });

            forkJoin(linkObs).subscribe({
              next: (resList) => {
                resList.forEach((res, i) => {
                  const imageId = Number(res?.data?.imageId ?? 0);
                  this.media.update((list) => [...list, { imageId, imageFullPath: urls[i] }]);
                });
                this.toast.success('Images uploaded and linked.');
                this.clearUploadsState();
                this.submitSaveItem();
              },
              error: () => {
                this.toast.error('Images uploaded but failed to link to item.');
                this.clearUploadsState();
                this.submitSaveItem();
              },
            });
          } else {
            // New item: buffer them for linkage after save completes
            urls.forEach((url) => {
              this.newImagesToLink.push(url);
              this.media.update((list) => [...list, { imageId: 0, imageFullPath: url }]);
            });
            this.toast.success('Images uploaded.');
            this.clearUploadsState();
            this.submitSaveItem();
          }
        },
        error: (err) => {
          this.saving.set(false);
          this.uploading.set(false);
          this.uploadProgress.set(0);
          console.error('Product multi-upload failed:', err);
          this.toast.error('Product images upload failed.');
        },
      });
    } else {
      this.submitSaveItem();
    }
  }

  submitSaveItem(): void {
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
      isReturnWindowDays: v.isReturnWindowDays === true,
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
            const wasNew = !this.itemId();
            this.toast.success(wasNew ? 'Item created.' : 'Item updated.');
            if (wasNew) {
              this.itemId.set(savedId);
              this.router.navigate(['/catalog/items', savedId], { replaceUrl: true });
            }
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
        this.itemId.set(itemId);
        this.router.navigate(['/catalog/items', itemId], { replaceUrl: true });
      },
      error: () => {
        this.toast.error('Item saved but some images failed to link.');
        this.newImagesToLink = [];
        this.itemId.set(itemId);
        this.router.navigate(['/catalog/items', itemId], { replaceUrl: true });
      },
    });
  }

  // --- Variants Filtering ---
  updateVariantFilter(variantOptionId: number, valueId: number): void {
    this.variantFilters.update((prev) => ({ ...prev, [variantOptionId]: Number(valueId) }));
    this.applyVariantFilters();
  }

  clearVariantFilters(): void {
    this.variantFilters.set({});
    this.applyVariantFilters();
  }

  applyVariantFilters(): void {
    const filters = this.variantFilters();
    const activeFilterNames: string[] = [];
    const activeFilterValIds: number[] = [];

    for (const optId of Object.keys(filters)) {
      const valId = Number(filters[Number(optId)]);
      if (valId > 0) {
        activeFilterValIds.push(valId);
        const row = this.optionRows().find((r) => r.variantOptionId === Number(optId));
        if (row) {
          const valObj = row.values.find((val) => val.optionValueId === valId);
          if (valObj) {
            activeFilterNames.push(valObj.optionValueName);
          }
        }
      }
    }

    if (activeFilterValIds.length === 0) {
      this.variants.set(this.allVariants());
      return;
    }

    const filtered = this.allVariants().filter((v) => {
      // 1. Try matching by ID first
      const rawIds = v.variantOptionValueIds || '';
      if (rawIds.trim()) {
        const variantValIds = rawIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map(Number);
        
        const matchesAllIds = activeFilterValIds.every((filterValId) => 
          variantValIds.includes(filterValId)
        );
        if (matchesAllIds) return true;
      }

      // 2. Fallback: match by option value names against the variant name path parts
      const nameParts = v.itemVariantName
        .split('/')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      return activeFilterNames.every((valName) => 
        nameParts.includes(valName.toLowerCase())
      );
    });

    this.variants.set(filtered);
  }

  // --- Variant Image Mapping Modal ---
  openVariantImageMap(variant: ItemVariantRow): void {
    this.selectedVariantForImage.set(variant);
    this.variantImageSelection.set([]);
    this.service.getVariantImageDtl(this.itemId(), variant.itemVariantId).subscribe({
      next: (ids) => {
        this.variantImageSelection.set(ids);
        this.showImageMapModal.set(true);
      },
      error: () => {
        this.variantImageSelection.set([]);
        this.showImageMapModal.set(true);
      },
    });
  }

  closeImageMapModal(): void {
    this.showImageMapModal.set(false);
    this.selectedVariantForImage.set(null);
  }

  toggleImageSelect(imageId: number): void {
    const current = this.variantImageSelection();
    if (current.includes(imageId)) {
      this.variantImageSelection.set(current.filter((id) => id !== imageId));
    } else {
      this.variantImageSelection.set([...current, imageId]);
    }
  }

  saveImageMapping(): void {
    const v = this.selectedVariantForImage();
    if (!v) return;

    this.savingImageMapping.set(true);
    this.service.saveVariantImages(this.itemId(), v.itemVariantId, this.variantImageSelection()).subscribe({
      next: () => {
        this.savingImageMapping.set(false);
        this.showImageMapModal.set(false);
        this.toast.success('Images assigned to variant successfully.');
        this.loadVariants();
      },
      error: () => {
        this.savingImageMapping.set(false);
        this.toast.error('Failed to assign images to variant.');
      },
    });
  }
}
