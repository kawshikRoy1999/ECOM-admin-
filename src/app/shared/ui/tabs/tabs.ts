import { Component, input, model } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
}

/** Presentational tab bar. Bind [(active)] and render content yourself. */
@Component({
  selector: 'app-tabs',
  template: `
    <div class="inline-flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/40 shadow-2xs select-none">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          (click)="active.set(tab.id)"
          class="px-4 py-1.5 rounded-lg text-[12.5px] font-bold transition-all duration-300 cursor-pointer select-none focus:outline-none"
          [class]="
            active() === tab.id
              ? 'bg-white text-slate-800 shadow-xs'
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
