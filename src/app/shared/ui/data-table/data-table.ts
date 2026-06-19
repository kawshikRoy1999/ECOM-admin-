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
}
