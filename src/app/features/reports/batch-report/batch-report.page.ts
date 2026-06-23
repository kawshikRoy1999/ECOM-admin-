import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { Select } from '../../../shared/ui/select/select';
import { BatchReportService } from './batch-report.service';
import { BatchReportPage, NamedOption } from './batch-report.models';

@Component({
  selector: 'app-batch-report-page',
  imports: [FormsModule, Select, DecimalPipe],
  templateUrl: './batch-report.page.html',
})
export class BatchReportPageComponent implements OnDestroy {
  private readonly service = inject(BatchReportService);

  readonly categories = signal<NamedOption[]>([]);
  readonly items = signal<NamedOption[]>([]);
  readonly variants = signal<NamedOption[]>([]);

  readonly selCategoryId = signal(0);
  readonly selItemId = signal(0);
  readonly selVariantId = signal(0);
  search = '';

  readonly pageSizes = [10, 20, 30, 40, 50];
  readonly pageSize = signal(20);
  readonly pageNumber = signal(1);

  readonly result = signal<BatchReportPage | null>(null);
  readonly loading = signal(false);

  readonly rows = computed(() => this.result()?.batchReportList ?? []);
  readonly totalPages = computed(() => this.result()?.totalPageNumber ?? 0);

  private readonly searchSubject = new Subject<string>();
  private readonly searchSubscription: Subscription;

  constructor() {
    this.service.categories().subscribe({ next: (c) => this.categories.set(c) });
    this.searchSubscription = this.searchSubject
      .pipe(
        debounceTime(350),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.searchReport();
      });
    this.runReport();
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }

  onCategoryChange(id: number): void {
    this.selCategoryId.set(Number(id));
    this.selItemId.set(0);
    this.selVariantId.set(0);
    this.items.set([]);
    this.variants.set([]);
    const cat = this.categories().find((c) => c.id === Number(id));
    if (cat) {
      this.service.itemsByCategory(cat.name).subscribe({ next: (i) => this.items.set(i) });
    }
    this.searchReport();
  }

  onItemChange(id: number): void {
    this.selItemId.set(Number(id));
    this.selVariantId.set(0);
    this.variants.set([]);
    if (id) {
      this.service.variantsByItem(Number(id)).subscribe({ next: (v) => this.variants.set(v) });
    }
    this.searchReport();
  }

  onVariantChange(id: number): void {
    this.selVariantId.set(Number(id));
    this.searchReport();
  }

  onSearchInput(val: string): void {
    this.search = val;
    this.searchSubject.next(val);
  }


  clearFilters(): void {
    this.selCategoryId.set(0);
    this.selItemId.set(0);
    this.selVariantId.set(0);
    this.search = '';
    this.items.set([]);
    this.variants.set([]);
    this.searchReport();
  }

  searchReport(): void {
    this.pageNumber.set(1);
    this.runReport();
  }

  runReport(): void {
    this.loading.set(true);
    this.service
      .report({
        categoryId: this.selCategoryId(),
        categoryName: '',
        itemId: this.selItemId(),
        itemVariantId: this.selVariantId(),
        searchCriteria: this.search.trim(),
        pageNumber: this.pageNumber(),
        recordPerPage: this.pageSize(),
      })
      .subscribe({
        next: (r) => {
          this.result.set(r);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  changePageSize(size: number): void {
    this.pageSize.set(Number(size));
    this.pageNumber.set(1);
    this.runReport();
  }

  prevPage(): void {
    if (this.pageNumber() > 1) {
      this.pageNumber.update((p) => p - 1);
      this.runReport();
    }
  }

  nextPage(): void {
    if (this.pageNumber() < this.totalPages()) {
      this.pageNumber.update((p) => p + 1);
      this.runReport();
    }
  }
}
