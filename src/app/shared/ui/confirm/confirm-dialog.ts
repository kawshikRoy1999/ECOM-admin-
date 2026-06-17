import { Component, inject } from '@angular/core';

import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (confirm.state(); as s) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
        (click)="confirm.respond(false)"
      >
        <div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <p class="text-sm text-slate-700">{{ s.message }}</p>
          <div class="mt-6 flex justify-end gap-2">
            <button
              (click)="confirm.respond(false)"
              class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              (click)="confirm.respond(true)"
              class="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              [class]="s.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'"
            >
              {{ s.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  readonly confirm = inject(ConfirmService);
}
