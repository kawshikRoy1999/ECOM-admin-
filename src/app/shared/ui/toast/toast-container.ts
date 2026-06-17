import { Component, inject } from '@angular/core';

import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-3">
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded border-l-4 px-4 py-3 text-sm shadow-lg ring-1 ring-slate-900/5 transition-all"
          [class]="styles(t.kind)"
        >
          <span class="mt-0.5" [innerHTML]="icon(t.kind)"></span>
          <span class="flex-1 font-medium">{{ t.message }}</span>
          <button (click)="toast.dismiss(t.id)" class="text-slate-400 hover:text-slate-600">
            <svg class="h-3 w-3 fill-current" viewBox="0 0 20 20">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
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
        return 'border-green-600 bg-white text-slate-800';
      case 'error':
        return 'border-red-600 bg-white text-slate-800';
      default:
        return 'border-brand-500 bg-white text-slate-800';
    }
  }

  icon(kind: string): string {
    const success = `<svg class="h-4 w-4 text-green-600 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
    const error = `<svg class="h-4 w-4 text-red-600 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
    const info = `<svg class="h-4 w-4 text-brand-500 fill-current" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`;
    return kind === 'success' ? success : kind === 'error' ? error : info;
  }
}
