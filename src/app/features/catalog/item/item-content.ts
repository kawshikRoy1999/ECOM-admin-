import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Select } from '../../../shared/ui/select/select';
import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ItemService } from './item.service';
import { ItemFaq, ItemMeta, ItemTag, NamedOption, SimilarItem } from './item.models';

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

  readonly tabs: TabItem[] = [
    { id: 'tags', label: 'Tags' },
    { id: 'seo', label: 'SEO / Meta' },
    { id: 'faq', label: 'FAQ' },
    { id: 'similar', label: 'Similar Items' },
  ];
  readonly activeTab = signal('tags');
  readonly saving = signal(false);

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
}
