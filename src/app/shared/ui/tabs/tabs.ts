import { Component, input, model } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
}

/** Presentational tab bar. Bind [(active)] and render content yourself. */
@Component({
  selector: 'app-tabs',
  template: `
    <div class="flex gap-1 border-b border-slate-200">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          (click)="active.set(tab.id)"
          class="relative -mb-px px-4 py-2.5 text-[13px] font-semibold transition-colors"
          [class]="
            active() === tab.id
              ? 'text-brand-700 border-b-2 border-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          "
        >
          {{ tab.label }}
        </button>
      }
    </div>
  `,
})
export class Tabs {
  readonly tabs = input.required<TabItem[]>();
  readonly active = model.required<string>();
}
