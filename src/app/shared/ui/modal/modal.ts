import { Component, input, output } from '@angular/core';

/**
 * Reusable modal shell. Project content into the default slot, and optional
 * footer actions into [slot=footer].
 */
@Component({
  selector: 'app-modal',
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px] p-4"
      (click)="close.emit()"
    >
      <div
        class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200/50"
        [class]="widthClass()"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 class="text-[13px] font-bold text-slate-800 tracking-wider uppercase">{{ title() }}</h3>
          <button
            type="button"
            (click)="close.emit()"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer focus:outline-none"
            aria-label="Close"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6 bg-white text-[13.5px]">
          <ng-content />
        </div>

        <footer class="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <ng-content select="[footer]" />
        </footer>
      </div>
    </div>
  `,
})
export class Modal {
  readonly title = input('');
  readonly widthClass = input('max-w-lg');
  readonly close = output<void>();
}
