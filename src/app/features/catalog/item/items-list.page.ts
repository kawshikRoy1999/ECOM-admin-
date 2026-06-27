import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';

import { Select } from '../../../shared/ui/select/select';
import { ItemService } from './item.service';
import { ItemListRow, NamedOption } from './item.models';

@Component({
  selector: 'app-items-list-page',
  imports: [FormsModule, Select, DecimalPipe],
  templateUrl: './items-list.page.html',
})
export class ItemsListPage {
  private readonly service = inject(ItemService);
  private readonly router = inject(Router);

  readonly rows = signal<ItemListRow[]>([]);
  readonly loading = signal(false);
  readonly brands = signal<NamedOption[]>([]);
  readonly itemCount = signal(0);

  // Filters
  search = '';
  readonly brandFilter = signal(0);
  readonly activeFilter = signal<number>(-1); // -1 all, 1 active, 0 inactive

  readonly pageNumber = signal(1);
  readonly totalPages = signal(0);
  readonly totalRecord = signal(0);
  readonly pageSize = 20;

  readonly activeOptions = [
    { id: -1, name: 'All' },
    { id: 1, name: 'Active' },
    { id: 0, name: 'Inactive' },
  ];

  constructor() {
    this.service.ddlLists().subscribe({
      next: (d) => {
        this.brands.set(d.brands);
        this.itemCount.set(d.itemCount);
      },
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const active = this.activeFilter(); // -1 all, 1 active, 0 inactive
    this.service
      .list({
        itemName: this.search.trim(),
        brandId: this.brandFilter() || undefined,
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

  setActive(v: number): void {
    this.activeFilter.set(v);
    this.searchNow();
  }

  prevPage(): void {
    if (this.pageNumber() > 1) {
      this.pageNumber.update((p) => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.pageNumber() < this.totalPages()) {
      this.pageNumber.update((p) => p + 1);
      this.load();
    }
  }

  newItem(): void {
    this.router.navigate(['/catalog/items/new']);
  }

  editItem(row: ItemListRow): void {
    this.router.navigate(['/catalog/items', row.id]);
  }
}
