import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, UpperCasePipe, DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';

import { Select } from '../../../shared/ui/select/select';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { TooltipService } from '../../../shared/ui/tooltip.service';
import { ReviewService } from './review.service';
import {
  CustomerRating,
  NamedOption,
  REVIEW_APPROVED,
  REVIEW_PENDING,
  REVIEW_REJECTED,
} from './review.models';

@Component({
  selector: 'app-review-page',
  imports: [FormsModule, Select, DatePipe, UpperCasePipe, DecimalPipe],
  templateUrl: './review.page.html',
})
export class ReviewPage {
  private readonly service = inject(ReviewService);
  private readonly toast = inject(ToastService);
  public readonly tooltip = inject(TooltipService);

  readonly REVIEW_PENDING = REVIEW_PENDING;
  readonly REVIEW_APPROVED = REVIEW_APPROVED;
  readonly REVIEW_REJECTED = REVIEW_REJECTED;

  readonly categories = signal<NamedOption[]>([]);
  readonly reviews = signal<CustomerRating[]>([]);
  readonly loading = signal(false);
  readonly updating = signal(false);

  // Filters
  readonly selCategoryId = signal(0);
  // status filter: -1 = all, else 0/1/2
  readonly statusFilter = signal<number>(REVIEW_PENDING);

  readonly statusOptions = [
    { id: -1, name: 'All' },
    { id: REVIEW_PENDING, name: 'Pending' },
    { id: REVIEW_APPROVED, name: 'Approved' },
    { id: REVIEW_REJECTED, name: 'Rejected' },
  ];

  // Selection states
  readonly selectedReview = signal<CustomerRating | null>(null);
  readonly selectedIds = signal<Set<number>>(new Set());
  readonly allSelected = computed(() => {
    const rows = this.reviews();
    return rows.length > 0 && rows.every((r) => this.selectedIds().has(r.ratingId));
  });

  constructor() {
    this.service.categories().subscribe({ next: (c) => this.categories.set(c) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());
    this.selectedReview.set(null);
    const cat = this.selCategoryId() || null;
    const status = this.statusFilter() < 0 ? null : this.statusFilter();
    this.service.ratings(cat, status).subscribe({
      next: (rows) => {
        this.reviews.set(rows);
        if (rows.length > 0) {
          this.selectedReview.set(rows[0]);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setStatusFilter(s: number): void {
    this.statusFilter.set(s);
    this.load();
  }

  selectReview(r: CustomerRating): void {
    this.selectedReview.set(r);
  }

  // --- Selection ---
  isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: number, checked: boolean, event?: Event): void {
    event?.stopPropagation(); // Prevent selection highlight trigger on row click
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  toggleSelectAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.reviews().map((r) => r.ratingId)) : new Set());
  }

  // --- Moderation ---
  updateOne(r: CustomerRating, status: number): void {
    this.updating.set(true);
    this.service.updateStatus(r.ratingId, status).subscribe({
      next: () => {
        this.updating.set(false);
        this.toast.success(status === REVIEW_APPROVED ? 'Review approved.' : 'Review rejected.');
        this.load();
      },
      error: () => this.updating.set(false),
    });
  }

  updateSelected(status: number): void {
    const ids = [...this.selectedIds()];
    if (!ids.length) {
      this.toast.error('Select at least one review.');
      return;
    }
    this.updating.set(true);
    forkJoin(ids.map((id) => this.service.updateStatus(id, status))).subscribe({
      next: () => {
        this.updating.set(false);
        this.toast.success(
          `${ids.length} review(s) ${status === REVIEW_APPROVED ? 'approved' : 'rejected'}.`,
        );
        this.load();
      },
      error: () => this.updating.set(false),
    });
  }

  stars(rating: number): number[] {
    return [1, 2, 3, 4, 5].map((i) => (i <= Math.round(rating) ? 1 : 0));
  }
}
