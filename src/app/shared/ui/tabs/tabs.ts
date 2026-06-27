import { Component, input, model } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
}

/** Presentational tab bar. Bind [(active)] and render content yourself. */
@Component({
  selector: 'app-tabs',
  template: `
    <div class="flex flex-nowrap overflow-x-auto scrollbar-none w-max max-w-full p-1 bg-slate-100/80 rounded-xl border border-slate-200/40 shadow-2xs select-none gap-0.5">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          (click)="active.set(tab.id)"
          class="px-4 py-1.5 rounded-lg text-[12.5px] font-bold transition-all duration-300 cursor-pointer select-none focus:outline-none whitespace-nowrap shrink-0 flex items-center gap-1.5"
          [class]="
            active() === tab.id
              ? 'bg-white text-slate-800 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          "
        >
          @let item = splitLabel(tab.label);
          <span>{{ item.text }}</span>
          @if (item.count !== undefined) {
            <span
              class="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none animate-count-pop transition-colors duration-300"
              [class]="
                active() === tab.id
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-slate-200/60 text-slate-400'
              "
            >
              {{ item.count }}
            </span>
          }
        </button>
      }
    </div>
  `,
  styles: [`
    @keyframes countPop {
      0% {
        transform: scale(0.6);
        opacity: 0;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
    .animate-count-pop {
      animation: countPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      transform-origin: center;
    }
  `]
})
export class Tabs {
  readonly tabs = input.required<TabItem[]>();
  readonly active = model.required<string>();

  splitLabel(label: string): { text: string; count?: string } {
    const match = label.match(/^(.*?)\s*(?:\((\d+)\))?$/);
    if (match) {
      return {
        text: match[1],
        count: match[2] || undefined
      };
    }
    return { text: label };
  }
}
