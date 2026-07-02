import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, skip } from 'rxjs';

import { Select } from '../../../shared/ui/select/select';
import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { TooltipService } from '../../../shared/ui/tooltip.service';
import { ItemService } from './item.service';
import { ItemListRow, NamedOption } from './item.models';

@Component({
  selector: 'app-items-list-page',
  imports: [FormsModule, Select, DataTable],
  templateUrl: './items-list.page.html',
})
export class ItemsListPage {
  private readonly service = inject(ItemService);
  private readonly router = inject(Router);
  public readonly tooltip = inject(TooltipService);

  readonly columns: Column<ItemListRow>[] = [
    { key: 'imageUrl', header: '' },
    { key: 'itemCode', header: 'Code' },
    { key: 'name', header: 'Item' },
    { key: 'brand', header: 'Brand' },
    { key: 'price', header: 'Price', align: 'right', format: (row) => Number(row.price ?? 0).toFixed(2) },
    { key: 'isActive', header: 'Status', align: 'center', format: (row) => (row.isActive ? 'Active' : 'Inactive') },
  ];

  readonly rows = signal<ItemListRow[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly brands = signal<NamedOption[]>([]);
  readonly categories = signal<NamedOption[]>([]);
  readonly itemCount = signal(0);

  // Filters
  readonly search = signal('');
  readonly brandFilter = signal(0);
  readonly categoryFilter = signal(0); // category id (0 = all); endpoint filters by category NAME
  readonly activeFilter = signal<number>(-1); // -1 all, 1 active, 0 inactive

  /** GetItemList filters by category NAME, so resolve the selected id → name. */
  private categoryName(): string {
    return this.categories().find((c) => c.id === this.categoryFilter())?.name ?? '';
  }

  readonly pageNumber = signal(1);
  readonly totalPages = signal(0);
  readonly totalRecord = signal(0);
  readonly pageSize = 20;

  readonly activeOptions = [
    { id: -1, name: 'All' },
    { id: 1, name: 'Active' },
    { id: 0, name: 'Inactive' },
  ];

  private lastLoadedParams = '';

  constructor() {
    this.service.ddlLists().subscribe({
      next: (d) => {
        this.brands.set(d.brands);
        this.categories.set(d.categories);
        this.itemCount.set(d.itemCount);
      },
    });
    this.load();

    // Debounce search and filter updates by 400ms (just like order list page)
    toObservable(computed(() => ({
      search: this.search(),
      brandId: this.brandFilter(),
      categoryId: this.categoryFilter(),
      active: this.activeFilter(),
    }))).pipe(
      skip(1),
      debounceTime(400)
    ).subscribe(() => {
      this.searchNow();
    });
  }

  load(): void {
    const active = this.activeFilter();
    const currentParams = `${this.search().trim()}_${this.brandFilter()}_${this.categoryFilter()}_${active}_${this.pageNumber()}`;

    // Prevent duplicate API hits if params haven't changed
    if (currentParams === this.lastLoadedParams) {
      return;
    }
    this.lastLoadedParams = currentParams;

    this.loading.set(true);
    this.service
      .list({
        itemName: this.search().trim(),
        brandId: this.brandFilter() || undefined,
        categoryName: this.categoryName(),
        isAll: active < 0,
        isActive: active === 1,
        pageNumber: this.pageNumber(),
        recordPerPage: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.rows);
          this.totalPages.set(res.totalPageNumber);
          this.totalRecord.set(res.totalRecord);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  searchNow(): void {
    this.pageNumber.set(1);
    this.load();
  }

  /** True when any filter differs from its default. */
  readonly hasActiveFilters = computed(
    () => !!this.search().trim() || this.brandFilter() !== 0 || this.categoryFilter() !== 0 || this.activeFilter() !== -1,
  );

  clearFilters(): void {
    if (!this.hasActiveFilters()) return;
    // The button unmounts once filters clear, so mouseleave never fires — hide manually.
    this.tooltip.hide();
    this.search.set('');
    this.brandFilter.set(0);
    this.categoryFilter.set(0);
    this.activeFilter.set(-1);
    this.searchNow();
  }

  setActive(v: number): void {
    this.activeFilter.set(v);
    this.searchNow();
  }

  onTableScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el) return;

    const threshold = 15;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    const hasMore = this.pageNumber() < this.totalPages();

    if (isNearBottom && hasMore && !this.loading() && !this.loadingMore()) {
      this.loadMore();
    }
  }

  loadMore(): void {
    const nextPage = this.pageNumber() + 1;
    this.pageNumber.set(nextPage);
    this.loadingMore.set(true);

    const active = this.activeFilter();
    const currentParams = `${this.search().trim()}_${this.brandFilter()}_${this.categoryFilter()}_${active}_${nextPage}`;
    this.lastLoadedParams = currentParams;

    this.service
      .list({
        itemName: this.search().trim(),
        brandId: this.brandFilter() || undefined,
        categoryName: this.categoryName(),
        isAll: active < 0,
        isActive: active === 1,
        pageNumber: nextPage,
        recordPerPage: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          const list = res?.rows ?? [];
          this.rows.update((existing) => [...existing, ...list]);
          this.totalPages.set(res.totalPageNumber);
          this.totalRecord.set(res.totalRecord);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }

  newItem(): void {
    this.router.navigate(['/catalog/items/new']);
  }

  editItem(row: ItemListRow): void {
    this.router.navigate(['/catalog/items', row.id]);
  }
}
