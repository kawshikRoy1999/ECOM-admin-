import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Select } from '../../../shared/ui/select/select';
import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ItemService } from './item.service';
import { ItemFaq, ItemMeta, ItemTag, NamedOption, SimilarItem, ItemVariantInfo, StockList, Bin, RequestSaveRolMoqDetails } from './item.models';

@Component({
  selector: 'app-item-content',
  imports: [FormsModule, Select, Tabs],
  templateUrl: './item-content.html',
})
export class ItemContent implements OnInit {
  private readonly service = inject(ItemService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly itemId = input.required<number>();
  readonly isSerialized = input<boolean>(false);

  readonly tabs: TabItem[] = [
    { id: 'tags', label: 'Tags' },
    { id: 'seo', label: 'SEO / Meta' },
    { id: 'faq', label: 'FAQ' },
    { id: 'similar', label: 'Similar Items' },
    { id: 'stock', label: 'Warehouse & Stock' },
  ];
  readonly activeTab = signal('tags');
  readonly saving = signal(false);

  // Stock & Inventory
  readonly stockVariants = signal<ItemVariantInfo[]>([]);
  readonly selectedStockVariantId = signal<number>(0);
  readonly locationStocks = signal<StockList[]>([]);
  readonly loadingStock = signal(false);
  readonly expandedStoreIds = signal<number[]>([]);
  readonly binLists = signal<Record<number, Bin[]>>({});
  readonly batchLists = signal<any[]>([]);
  readonly adjustingStore = signal<StockList | null>(null);
  readonly showAdjustModal = signal(false);
  readonly adjustingBins = signal<Bin[]>([]);
  readonly savingBinAdjustment = signal(false);

  // Tags
  readonly tags = signal<ItemTag[]>([]);
  newTag = '';

  // Meta
  readonly metas = signal<ItemMeta[]>([]);
  newMeta = '';

  // FAQ
  readonly faqs = signal<ItemFaq[]>([]);
  newFaq = '';
  newFaqAnswer = '';

  // Similar
  readonly similar = signal<SimilarItem[]>([]);
  readonly itemOptions = signal<NamedOption[]>([]);
  readonly variantOptions = signal<NamedOption[]>([]);
  readonly selSimItem = signal(0);
  readonly selSimVariant = signal(0);

  ngOnInit(): void {
    this.loadTags();
    this.loadMetas();
    this.loadFaqs();
    this.loadSimilar();
    this.loadStockVariants();
    this.service.itemOptions().subscribe({ next: (o) => this.itemOptions.set(o) });
  }

  // --- Tags ---
  loadTags(): void {
    this.service.tags(this.itemId()).subscribe({ next: (t) => this.tags.set(t) });
  }
  addTag(): void {
    if (!this.newTag.trim()) return;
    this.saving.set(true);
    this.service.saveTag(this.itemId(), 0, this.newTag.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.newTag = '';
        this.toast.success('Tag added.');
        this.loadTags();
      },
      error: () => this.saving.set(false),
    });
  }
  async removeTag(t: ItemTag): Promise<void> {
    if (!(await this.confirm.ask(`Delete tag "${t.tag}"?`, { confirmLabel: 'Delete', danger: true }))) return;
    this.service.deleteTag(t.tagId).subscribe({ next: () => { this.toast.success('Tag deleted.'); this.loadTags(); } });
  }

  // --- Meta ---
  loadMetas(): void {
    this.service.metas(this.itemId()).subscribe({ next: (m) => this.metas.set(m) });
  }
  addMeta(): void {
    if (!this.newMeta.trim()) return;
    this.saving.set(true);
    this.service.saveMeta(this.itemId(), 0, this.newMeta.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.newMeta = '';
        this.toast.success('Meta tag added.');
        this.loadMetas();
      },
      error: () => this.saving.set(false),
    });
  }
  async removeMeta(m: ItemMeta): Promise<void> {
    if (!(await this.confirm.ask(`Delete meta "${m.metaTag}"?`, { confirmLabel: 'Delete', danger: true }))) return;
    this.service.deleteMeta(m.metaTagId).subscribe({ next: () => { this.toast.success('Meta deleted.'); this.loadMetas(); } });
  }

  // --- FAQ ---
  loadFaqs(): void {
    this.service.faqs(this.itemId()).subscribe({ next: (f) => this.faqs.set(f) });
  }
  addFaq(): void {
    if (!this.newFaq.trim() || !this.newFaqAnswer.trim()) {
      this.toast.error('Question and answer are both required.');
      return;
    }
    this.saving.set(true);
    this.service.saveFaq(this.itemId(), 0, this.newFaq.trim(), this.newFaqAnswer.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.newFaq = '';
        this.newFaqAnswer = '';
        this.toast.success('FAQ added.');
        this.loadFaqs();
      },
      error: () => this.saving.set(false),
    });
  }
  async removeFaq(f: ItemFaq): Promise<void> {
    if (!(await this.confirm.ask('Delete this FAQ?', { confirmLabel: 'Delete', danger: true }))) return;
    this.service.deleteFaq(f.faqId).subscribe({ next: () => { this.toast.success('FAQ deleted.'); this.loadFaqs(); } });
  }

  // --- Similar ---
  loadSimilar(): void {
    this.service.similarItems(this.itemId()).subscribe({ next: (s) => this.similar.set(s) });
  }
  onSimItemChange(id: number): void {
    this.selSimItem.set(Number(id));
    this.selSimVariant.set(0);
    this.variantOptions.set([]);
    if (id) this.service.variantOptions(Number(id)).subscribe({ next: (v) => this.variantOptions.set(v) });
  }
  addSimilar(): void {
    if (!this.selSimItem()) {
      this.toast.error('Select an item to link.');
      return;
    }
    this.saving.set(true);
    this.service.saveSimilar(this.itemId(), this.selSimItem(), this.selSimVariant()).subscribe({
      next: () => {
        this.saving.set(false);
        this.selSimItem.set(0);
        this.selSimVariant.set(0);
        this.variantOptions.set([]);
        this.toast.success('Similar item linked.');
        this.loadSimilar();
      },
      error: () => this.saving.set(false),
    });
  }
  toggleSimilar(s: SimilarItem): void {
    this.service.toggleSimilar(s.similarItemId, !s.isActive).subscribe({
      next: () => {
        this.similar.update((list) => list.map((x) => (x.similarItemId === s.similarItemId ? { ...x, isActive: !x.isActive } : x)));
        this.toast.success(s.isActive ? 'Deactivated.' : 'Activated.');
      },
    });
  }
  async removeSimilar(s: SimilarItem): Promise<void> {
    if (!(await this.confirm.ask(`Remove "${s.similarItemName}"?`, { confirmLabel: 'Remove', danger: true }))) return;
    this.service.deleteSimilar(s.similarItemId).subscribe({ next: () => { this.toast.success('Removed.'); this.loadSimilar(); } });
  }

  // --- Stock & Warehouse Inventory Tab ---
  loadStockVariants(): void {
    this.service.variants(this.itemId()).subscribe({
      next: (v) => {
        const vars = v.map((x) => ({
          id: x.itemVariantId,
          name: x.itemVariantName,
        }));
        this.stockVariants.set(vars);
        if (vars.length && !this.selectedStockVariantId()) {
          this.selectedStockVariantId.set(vars[0].id);
          this.loadLocationStock(vars[0].id);
        }
      }
    });
  }

  onStockVariantChange(variantId: number): void {
    this.selectedStockVariantId.set(Number(variantId));
    if (variantId) {
      this.loadLocationStock(Number(variantId));
    } else {
      this.locationStocks.set([]);
    }
  }

  loadLocationStock(variantId: number): void {
    this.loadingStock.set(true);
    const serialized = this.isSerialized();
    this.service.getStoreList(this.itemId(), variantId, serialized).subscribe({
      next: (list) => {
        this.locationStocks.set(list);
        this.loadingStock.set(false);
      },
      error: () => {
        this.loadingStock.set(false);
      },
    });
  }

  toggleStoreExpanded(storeId: number): void {
    const current = this.expandedStoreIds();
    if (current.includes(storeId)) {
      this.expandedStoreIds.set(current.filter((id) => id !== storeId));
    } else {
      this.expandedStoreIds.set([...current, storeId]);
      this.loadBins(storeId);
    }
  }

  loadBins(storeId: number): void {
    const variantId = this.selectedStockVariantId();
    this.service.getBinList(storeId, this.itemId(), variantId, false).subscribe({
      next: (bins) => {
        this.binLists.update((prev) => ({ ...prev, [storeId]: bins }));
      },
    });
  }

  saveLocationRolMoq(storeId: number): void {
    const stock = this.locationStocks().find((s) => s.storeId === storeId);
    if (!stock) return;

    const payload: RequestSaveRolMoqDetails = {
      itemROIMOQDetailsId: stock.itemROIMOQDetailsId || 0,
      itemId: this.itemId(),
      itemVariantId: this.selectedStockVariantId(),
      rol: Number(stock.rol) || 0,
      moq: Number(stock.moq) || 0,
      storeId: storeId,
    };

    this.service.saveRolMoq(payload).subscribe({
      next: () => {
        this.toast.success('ROL & MOQ saved successfully.');
        this.loadLocationStock(this.selectedStockVariantId());
      },
      error: () => {
        this.toast.error('Failed to save ROL & MOQ.');
      },
    });
  }

  updateLocationRolMoq(storeId: number, field: 'rol' | 'moq', value: number): void {
    this.locationStocks.update((list) =>
      list.map((s) => (s.storeId === storeId ? { ...s, [field]: value } : s))
    );
  }

  openAdjustQuantity(store: StockList): void {
    this.adjustingStore.set(store);
    const variantId = this.selectedStockVariantId();
    // Load batch dropdown list
    this.service.getVariantBatchCodeList(this.itemId(), variantId).subscribe({
      next: (batches) => {
        this.batchLists.set(batches);
      },
    });
    // Load bins for editing
    this.service.getBinList(store.storeId, this.itemId(), variantId, true).subscribe({
      next: (bins) => {
        this.adjustingBins.set(bins.length ? bins : [this.blankBin(store.storeId)]);
        this.showAdjustModal.set(true);
      },
    });
  }

  closeAdjustModal(): void {
    this.showAdjustModal.set(false);
    this.adjustingStore.set(null);
    this.adjustingBins.set([]);
  }

  blankBin(storeId: number): Bin {
    return {
      binId: 0,
      name: 'BinOne',
      isActive: true,
      storeId: storeId,
      isDefault: true,
      currentStock: 0,
      isModal: true,
      itemId: this.itemId(),
      itemVariantId: this.selectedStockVariantId(),
    };
  }

  addAdjustBinRow(): void {
    const store = this.adjustingStore();
    if (store) {
      this.adjustingBins.update((list) => [...list, this.blankBin(store.storeId)]);
    }
  }

  removeAdjustBinRow(idx: number): void {
    this.adjustingBins.update((list) => list.filter((_, i) => i !== idx));
  }

  updateAdjustBin(idx: number, field: keyof Bin, value: any): void {
    this.adjustingBins.update((list) =>
      list.map((b, i) => (i === idx ? { ...b, [field]: value } : b))
    );
  }

  saveBinAdjustment(): void {
    const bins = this.adjustingBins();
    const store = this.adjustingStore();
    if (!store) return;

    this.savingBinAdjustment.set(true);
    this.service.saveUpdateBin(bins).subscribe({
      next: () => {
        this.savingBinAdjustment.set(false);
        this.showAdjustModal.set(false);
        this.toast.success('Stock adjusted successfully.');
        this.loadLocationStock(this.selectedStockVariantId());
        if (this.expandedStoreIds().includes(store.storeId)) {
          this.loadBins(store.storeId);
        }
      },
      error: () => {
        this.savingBinAdjustment.set(false);
        this.toast.error('Failed to adjust stock.');
      },
    });
  }
}
