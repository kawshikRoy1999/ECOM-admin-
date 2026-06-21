import { Component, TemplateRef, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export interface Column<T> {
  key: keyof T & string;
  header: string;
  align?: 'left' | 'center' | 'right';
  /** Optional cell formatter; defaults to the raw value. */
  format?: (row: T) => string;
}

/**
 * Generic, reusable data table: client-side search + a projected actions column.
 * Usage:
 *   <app-data-table [columns]="cols" [rows]="rows()" [loading]="loading()"
 *                   [actions]="actionsTpl">
 *   </app-data-table>
 *   <ng-template #actionsTpl let-row> ...buttons... </ng-template>
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet],
  templateUrl: './data-table.html',
  host: {
    '[class.flex]': 'fillHeight()',
    '[class.flex-col]': 'fillHeight()',
    '[class.flex-1]': 'fillHeight()',
    '[class.min-h-0]': 'fillHeight()',
  },
})
export class DataTable<T extends object> {
  readonly columns = input.required<Column<T>[]>();
  readonly rows = input.required<T[]>();
  readonly loading = input(false);
  readonly emptyText = input('No records found.');
  readonly searchable = input(true);
  readonly searchPlaceholder = input('Search…');
  readonly actions = input<TemplateRef<unknown> | null>(null);
  readonly maxHeightClass = input<string>('max-h-[calc(100vh-170px)] md:max-h-[calc(100vh-190px)]');
  /** When true, the table stretches to fill available parent flex space instead of using fixed max-height. */
  readonly fillHeight = input(false);

  readonly query = signal('');

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.rows();
    if (!q) return rows;
    return rows.filter((row) =>
      this.columns().some((c) => String(row[c.key] ?? '').toLowerCase().includes(q)),
    );
  });

  cell(row: T, col: Column<T>): string {
    return col.format ? col.format(row) : String(row[col.key] ?? '');
  }

  alignClass(col: Column<T>): string {
    return col.align === 'right'
      ? 'text-right'
      : col.align === 'center'
        ? 'text-center'
        : 'text-left';
  }

  isStatusColumn(col: Column<T>, val: string): boolean {
    const key = col.key.toLowerCase();
    const value = val.toLowerCase();
    return (
      key.includes('status') ||
      key === 'isactive' ||
      value === 'active' ||
      value === 'inactive' ||
      value === 'delivered' ||
      value === 'cancelled' ||
      value === 'placed' ||
      value === 'pending'
    );
  }

  statusClasses(val: string): { bg: string; text: string; dot: string; ring: string } {
    const value = val.toLowerCase();
    // Green / Positive
    if (
      value === 'active' ||
      value.includes('delivered') ||
      value.includes('paid') ||
      value.includes('approved') ||
      value.includes('success') ||
      value.includes('completed') ||
      value.includes('accept')
    ) {
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
        ring: 'ring-emerald-600/10'
      };
    }
    // Red / Negative / Error
    if (
      value === 'inactive' ||
      value.includes('cancel') ||
      value.includes('reject') ||
      value.includes('fail') ||
      value.includes('refunded')
    ) {
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        dot: 'bg-rose-500',
        ring: 'ring-rose-600/10'
      };
    }
    // Amber / Warning / In-Progress
    if (
      value.includes('pending') ||
      value.includes('placed') ||
      value.includes('dispatch') ||
      value.includes('ready') ||
      value.includes('processing') ||
      value.includes('requested') ||
      value.includes('return') ||
      value.includes('refund')
    ) {
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
        ring: 'ring-amber-600/10'
      };
    }
    // Gray / Neutral
    return {
      bg: 'bg-slate-50',
      text: 'text-slate-600',
      dot: 'bg-slate-400',
      ring: 'ring-slate-500/10'
    };
  }

  isImageColumn(col: Column<T>, val: any): boolean {
    const key = col.key.toLowerCase();
    if (typeof val !== 'string') return false;
    return (
      key.includes('image') &&
      (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/') || val.startsWith('http:/') || val.startsWith('https:/'))
    );
  }

  isReturnImageList(col: Column<T>, val: any): boolean {
    return col.key === 'returnImageList' && Array.isArray(val);
  }

  cleanImageUrl(url: string): string {
    if (!url) return '';
    // Fix single slash malformation (e.g. http:/domain.com)
    if (url.startsWith('http:/') && !url.startsWith('http://')) {
      return 'http://' + url.substring(6);
    }
    if (url.startsWith('https:/') && !url.startsWith('https://')) {
      return 'https://' + url.substring(7);
    }
    return url;
  }

  readonly previewImageUrl = signal<string>('');

  openPreview(url: string, event: MouseEvent): void {
    event.stopPropagation();
    this.previewImageUrl.set(url);
  }

  closePreview(): void {
    this.previewImageUrl.set('');
  }
}

