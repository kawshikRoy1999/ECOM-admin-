import { Component, input, model } from '@angular/core';

@Component({
  selector: 'app-checkbox',
  standalone: true,
  imports: [],
  template: `
    <label class="relative flex items-center justify-center shrink-0 cursor-pointer select-none">
      <input
        type="checkbox"
        class="sr-only"
        [checked]="checked()"
        [disabled]="disabled()"
        (change)="onToggle($event)"
      />
      <!-- Styled Custom Box -->
      <div
        class="flex h-4.5 w-4.5 items-center justify-center rounded-md border transition-all duration-300 ease-out select-none shadow-3xs"
        [class.bg-brand-50]="checked() || indeterminate()"
        [class.border-brand-300]="checked() || indeterminate()"
        [class.bg-white]="!checked() && !indeterminate()"
        [class.border-slate-200]="!checked() && !indeterminate()"
        [class.hover:border-brand-400]="!disabled() && !checked() && !indeterminate()"
        [class.hover:bg-slate-50/30]="!disabled() && !checked() && !indeterminate()"
        [class.opacity-50]="disabled()"
        [class.cursor-not-allowed]="disabled()"
      >
        @if (checked() && !indeterminate()) {
          <!-- Tickmark SVG -->
          <svg class="h-3.5 w-3.5 text-brand-500 animate-scaleIn" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        } @else if (indeterminate()) {
          <!-- Indeterminate Dash SVG -->
          <svg class="h-2.5 w-2.5 text-brand-500 animate-scaleIn" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 12H6" />
          </svg>
        }
      </div>
    </label>
  `,
  styles: [`
    .animate-scaleIn {
      animation: scaleIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes scaleIn {
      from {
        transform: scale(0.6);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `]
})
export class Checkbox {
  readonly checked = model<boolean>(false);
  readonly indeterminate = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  onToggle(event: Event): void {
    if (this.disabled()) return;
    const target = event.target as HTMLInputElement;
    this.checked.set(target.checked);
  }
}
