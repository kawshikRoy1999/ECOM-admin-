import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subject, debounceTime, switchMap } from 'rxjs';

import { Modal } from '../../../shared/ui/modal/modal';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Select } from '../../../shared/ui/select/select';
import { ColorPicker } from '../../../shared/ui/color-picker/color-picker';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { TemplatesService } from './templates.service';
import { CustomGroup } from './template.models';
import {
  ItemImage,
  SECTION_FOR_CUSTOM_GROUPS,
  SECTION_FOR_ITEMS,
  SECTION_FOR_VARIANTS,
  SectionMetadata,
  SectionProductResult,
  TemplateDetail,
  TemplateSection,
} from './builder.models';

@Component({
  selector: 'app-template-builder-page',
  imports: [ReactiveFormsModule, RouterLink, Modal, DragDropModule, ImageUpload, Select, ColorPicker],
  templateUrl: './template-builder.page.html',
})
export class TemplateBuilderPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(TemplatesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly templateId = Number(this.route.snapshot.paramMap.get('id') ?? 0);

  readonly detail = signal<TemplateDetail | null>(null);
  readonly orderedSections = signal<TemplateSection[]>([]);
  readonly loading = signal(false);
  readonly reordering = signal(false);
  readonly savingMaster = signal(false);
  readonly expanded = signal<number | null>(null);

  // Section modal
  readonly metadata = signal<SectionMetadata | null>(null);
  readonly sectionModalOpen = signal(false);
  readonly editingSectionId = signal(0);
  readonly savingSection = signal(false);

  // Add-items modal
  readonly itemModalOpen = signal(false);
  readonly itemSection = signal<TemplateSection | null>(null);
  readonly savingItems = signal(false);
  // product/variant mode
  readonly productTerm = signal('');
  readonly productResults = signal<SectionProductResult[]>([]);
  readonly productSearching = signal(false);
  readonly stagedProducts = signal<SectionProductResult[]>([]);
  private readonly productSearch$ = new Subject<string>();
  // per-item image selection
  readonly expandedProduct = signal<SectionProductResult | null>(null);
  readonly itemImages = signal<ItemImage[]>([]);
  readonly loadingImages = signal(false);
  // custom-group mode
  readonly allGroups = signal<CustomGroup[]>([]);
  readonly stagedGroupIds = signal<number[]>([]);
  // create-group-inline
  readonly newGroupOpen = signal(false);
  readonly newGroupName = signal('');
  readonly newGroupImage = signal('');
  readonly creatingGroup = signal(false);

  readonly SECTION_FOR_CUSTOM_GROUPS = SECTION_FOR_CUSTOM_GROUPS;
  readonly SECTION_FOR_VARIANTS = SECTION_FOR_VARIANTS;

  readonly masterForm = this.fb.nonNullable.group({
    templateName: ['', [Validators.required]],
    primaryColor: ['#000000'],
    secondaryColor: ['#000000'],
    tertiaryColor: ['#000000'],
    isActive: [true],
    isForB2C: [false],
    fontFamilyId: [0],
  });

  readonly sectionForm = this.fb.nonNullable.group({
    sectionName: ['', [Validators.required]],
    sectionFor: [SECTION_FOR_ITEMS, [Validators.required]],
    sectionType: [0],
    primaryText: [''],
    secondaryText: [''],
    tertiaryText: [''],
    sectionBackgroundColor: ['#ffffff'],
    isActive: [true],
  });

  constructor() {
    this.load();
    this.service.sectionMetadata().subscribe({ next: (m) => this.metadata.set(m) });

    this.productSearch$
      .pipe(
        debounceTime(300),
        switchMap((term) => {
          this.productSearching.set(true);
          return this.service.searchSectionProducts(term);
        }),
      )
      .subscribe({
        next: (rows) => {
          this.productResults.set(rows);
          this.productSearching.set(false);
        },
        error: () => this.productSearching.set(false),
      });
  }

  load(): void {
    this.loading.set(true);
    this.service.getTemplateDetail(this.templateId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.orderedSections.set(
          [...(d?.responseCompanyTemplateSections ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
        );
        this.loading.set(false);
        this.masterForm.reset({
          templateName: d?.templateName ?? '',
          primaryColor: d?.primaryColor || '#000000',
          secondaryColor: d?.secondaryColor || '#000000',
          tertiaryColor: d?.tertiaryColor || '#000000',
          isActive: d?.isActive ?? true,
          isForB2C: d?.isForB2C ?? false,
          fontFamilyId: d?.fontFamilyId ?? 0,
        });
      },
      error: () => this.loading.set(false),
    });
  }

  toggle(id: number): void {
    this.expanded.update((v) => (v === id ? null : id));
  }

  sectionForLabel(forId: number): string {
    return forId === SECTION_FOR_ITEMS
      ? 'Products'
      : forId === SECTION_FOR_VARIANTS
        ? 'Variants'
        : forId === SECTION_FOR_CUSTOM_GROUPS
          ? 'Custom Groups'
          : 'Other';
  }

  // --- Master ---
  saveMaster(): void {
    if (this.masterForm.invalid) {
      this.masterForm.markAllAsTouched();
      return;
    }
    this.savingMaster.set(true);
    const v = this.masterForm.getRawValue();
    this.service
      .saveTemplateMaster({
        companyTemplateId: this.templateId,
        templateName: v.templateName,
        primaryColor: v.primaryColor,
        secondaryColor: v.secondaryColor,
        tertiaryColor: v.tertiaryColor,
        isActive: v.isActive,
        isForB2C: v.isForB2C,
        fontFamilyId: v.fontFamilyId || null,
      })
      .subscribe({
        next: () => {
          this.savingMaster.set(false);
          this.toast.success('Template updated.');
        },
        error: () => this.savingMaster.set(false),
      });
  }

  // --- Sections ---
  openCreateSection(): void {
    this.editingSectionId.set(0);
    this.sectionForm.reset({
      sectionName: '',
      sectionFor: SECTION_FOR_ITEMS,
      sectionType: 0,
      primaryText: '',
      secondaryText: '',
      tertiaryText: '',
      sectionBackgroundColor: '#ffffff',
      isActive: true,
    });
    this.sectionModalOpen.set(true);
  }

  openEditSection(s: TemplateSection): void {
    this.editingSectionId.set(s.companyTemplateSectionId);
    this.sectionForm.reset({
      sectionName: s.sectionName,
      sectionFor: s.sectionFor,
      sectionType: s.sectionType,
      primaryText: s.primaryText ?? '',
      secondaryText: s.secondaryText ?? '',
      tertiaryText: s.tertiaryText ?? '',
      sectionBackgroundColor: s.sectionBackgrounColor || '#ffffff',
      isActive: s.isActive ?? true,
    });
    this.sectionModalOpen.set(true);
  }

  saveSection(): void {
    if (this.sectionForm.invalid) {
      this.sectionForm.markAllAsTouched();
      return;
    }
    this.savingSection.set(true);
    const v = this.sectionForm.getRawValue();
    this.service
      .saveSection({
        companyTemplateId: this.templateId,
        companyTemplateSectionId: this.editingSectionId(),
        sectionName: v.sectionName,
        sectionFor: Number(v.sectionFor),
        sectionType: Number(v.sectionType),
        primaryText: v.primaryText,
        secondaryText: v.secondaryText,
        tertiaryText: v.tertiaryText,
        sectionBackgroundColor: v.sectionBackgroundColor,
        isActive: v.isActive,
      })
      .subscribe({
        next: () => {
          this.savingSection.set(false);
          this.sectionModalOpen.set(false);
          this.toast.success(this.editingSectionId() ? 'Section updated.' : 'Section created.');
          this.load();
        },
        error: () => this.savingSection.set(false),
      });
  }

  // --- Drag reorder ---
  onDrop(event: CdkDragDrop<TemplateSection[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const list = [...this.orderedSections()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.orderedSections.set(list); // optimistic
    this.reordering.set(true);
    this.service.reorderSections(list.map((s) => s.companyTemplateSectionId)).subscribe({
      next: () => {
        this.reordering.set(false);
        this.toast.success('Section order saved.');
      },
      error: () => {
        this.reordering.set(false);
        this.load(); // revert to server order on failure
      },
    });
  }

  // --- Add section items ---
  openAddItems(s: TemplateSection): void {
    this.itemSection.set(s);
    this.stagedProducts.set([]);
    this.stagedGroupIds.set([]);
    this.productTerm.set('');
    this.productResults.set([]);
    this.expandedProduct.set(null);
    this.itemImages.set([]);
    if (s.sectionFor === SECTION_FOR_CUSTOM_GROUPS && !this.allGroups().length) {
      this.service.listCustomGroups().subscribe({ next: (g) => this.allGroups.set(g ?? []) });
    }
    this.itemModalOpen.set(true);
  }

  onProductTerm(term: string): void {
    this.productTerm.set(term);
    this.productSearch$.next(term);
  }

  /** Click a search result → load its images so a specific one can be picked. */
  expandProduct(p: SectionProductResult): void {
    if (this.expandedProduct()?.itemId === p.itemId) {
      this.expandedProduct.set(null);
      return;
    }
    this.expandedProduct.set(p);
    this.itemImages.set([]);
    this.loadingImages.set(true);
    this.service.itemImages(p.itemId).subscribe({
      next: (imgs) => {
        // fall back to the search thumbnail if the item has no image library
        this.itemImages.set(imgs.length ? imgs : [{ imageId: 0, path: p.imageUrl, isPrimary: true }]);
        this.loadingImages.set(false);
      },
      error: () => {
        this.itemImages.set([{ imageId: 0, path: p.imageUrl, isPrimary: true }]);
        this.loadingImages.set(false);
      },
    });
  }

  /** Stage a specific (item, image) selection. */
  stageImage(p: SectionProductResult, img: ItemImage): void {
    const entry: SectionProductResult = { ...p, imageUrl: img.path };
    const key = (x: SectionProductResult) => `${x.itemId}-${x.variantId}-${x.imageUrl}`;
    if (this.stagedProducts().some((x) => key(x) === key(entry))) return;
    this.stagedProducts.update((list) => [...list, entry]);
  }

  unstageProduct(index: number): void {
    this.stagedProducts.update((list) => list.filter((_, i) => i !== index));
  }

  toggleGroup(id: number, checked: boolean): void {
    this.stagedGroupIds.update((ids) =>
      checked ? [...new Set([...ids, id])] : ids.filter((g) => g !== id),
    );
  }

  /** Create a new custom group (with uploaded image) without leaving the picker. */
  createGroup(): void {
    const name = this.newGroupName().trim();
    if (!name) {
      this.toast.error('Group name is required.');
      return;
    }
    this.creatingGroup.set(true);
    this.service
      .saveCustomGroup({ customGroupId: 0, customGroupName: name, customGroupImageLink: this.newGroupImage(), isActive: true })
      .subscribe({
        next: () => {
          this.creatingGroup.set(false);
          this.newGroupOpen.set(false);
          this.newGroupName.set('');
          this.newGroupImage.set('');
          this.toast.success('Custom group created.');
          // refresh list and auto-select the new one
          this.service.listCustomGroups().subscribe({ next: (g) => this.allGroups.set(g ?? []) });
        },
        error: () => this.creatingGroup.set(false),
      });
  }

  saveItems(): void {
    const s = this.itemSection();
    if (!s) return;
    this.savingItems.set(true);

    const done = () => {
      this.savingItems.set(false);
      this.itemModalOpen.set(false);
      this.toast.success('Section updated.');
      this.load();
    };
    const fail = () => this.savingItems.set(false);

    if (s.sectionFor === SECTION_FOR_CUSTOM_GROUPS) {
      const groups = this.allGroups()
        .filter((g) => this.stagedGroupIds().includes(g.customGroupId))
        .map((g) => ({ id: g.customGroupId, name: g.customGroupName, imageLink: g.customGroupImageLink }));
      if (!groups.length) {
        this.savingItems.set(false);
        return;
      }
      this.service.saveSectionCustomGroups(s.companyTemplateSectionId, groups).subscribe({ next: done, error: fail });
    } else {
      const items = this.stagedProducts().map((p) => ({
        itemId: p.itemId,
        variantId: p.variantId,
        imageUrl: p.imageUrl,
      }));
      if (!items.length) {
        this.savingItems.set(false);
        return;
      }
      this.service.addSectionItems(s.companyTemplateSectionId, s.sectionFor, items).subscribe({ next: done, error: fail });
    }
  }

  async deleteItem(itemMappingId: number): Promise<void> {
    const ok = await this.confirm.ask('Remove this item from the section?', {
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    this.service.deleteSectionItem(itemMappingId).subscribe({
      next: () => {
        this.toast.success('Item removed.');
        this.load();
      },
    });
  }

  async deleteImage(imageMappingId: number): Promise<void> {
    const ok = await this.confirm.ask('Remove this image from the section?', {
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    this.service.deleteSectionImage(imageMappingId).subscribe({
      next: () => {
        this.toast.success('Image removed.');
        this.load();
      },
    });
  }
}
