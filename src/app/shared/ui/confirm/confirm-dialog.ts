import { Component, inject } from '@angular/core';

import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (confirm.state(); as s) {
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
        (click)="confirm.respond(false)"
      >
        <div class="w-full max-w-sm rounded-[2px] bg-white p-6 shadow-xl ring-1 ring-slate-900/5" (click)="$event.stopPropagation()">
          <h3 class="mb-2 text-base font-semibold text-slate-900 tracking-tight">Confirm Action</h3>
          <p class="text-sm text-slate-600 leading-relaxed">{{ s.message }}</p>
          <div class="mt-8 flex justify-end gap-2">
            <button
              (click)="confirm.respond(false)"
              class="btn-secondary min-w-[80px]"
            >
              Cancel
            </button>
            <button
              (click)="confirm.respond(true)"
              class="min-w-[80px]"
              [class]="s.danger ? 'btn-danger' : 'btn-primary'"
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
