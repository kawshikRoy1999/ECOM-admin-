import { Component, input, output } from '@angular/core';

/**
 * Reusable modal shell. Project content into the default slot, and optional
 * footer actions into [slot=footer].
 */
@Component({
  selector: 'app-modal',
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
      (click)="close.emit()"
    >
      <div
        class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-900/5"
        [class]="widthClass()"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-center justify-between border-b border-[#e1dfdd] bg-slate-50 px-6 py-4">
          <h3 class="text-[13px] font-bold text-slate-800 tracking-widest uppercase">{{ title() }}</h3>
          <button
            type="button"
            (click)="close.emit()"
            class="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close"
          >
            <svg class="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6 bg-white">
          <ng-content />
        </div>

        <footer class="flex justify-end gap-3 border-t border-[#e1dfdd] bg-slate-50 px-6 py-4">
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
