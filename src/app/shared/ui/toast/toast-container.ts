import { Component, inject } from '@angular/core';

import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg"
          [class]="styles(t.kind)"
        >
          <span class="mt-0.5">{{ icon(t.kind) }}</span>
          <span class="flex-1">{{ t.message }}</span>
          <button (click)="toast.dismiss(t.id)" class="text-current/60 hover:text-current">✕</button>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  readonly toast = inject(ToastService);

  styles(kind: string): string {
    switch (kind) {
      case 'success':
        return 'border-green-200 bg-green-50 text-green-800';
      case 'error':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return 'border-slate-200 bg-white text-slate-700';
    }
  }

  icon(kind: string): string {
    return kind === 'success' ? '✓' : kind === 'error' ? '⚠' : 'ℹ';
  }
}
