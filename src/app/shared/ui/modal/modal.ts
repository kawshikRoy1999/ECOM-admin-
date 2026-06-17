import { Component, input, output } from '@angular/core';

/**
 * Reusable modal shell. Project content into the default slot, and optional
 * footer actions into [slot=footer].
 */
@Component({
  selector: 'app-modal',
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      (click)="close.emit()"
    >
      <div
        class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        [class]="widthClass()"
        (click)="$event.stopPropagation()"
      >
        <header class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 class="text-base font-semibold text-slate-900">{{ title() }}</h3>
          <button
            type="button"
            (click)="close.emit()"
            class="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-5">
          <ng-content />
        </div>

        <footer class="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
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
