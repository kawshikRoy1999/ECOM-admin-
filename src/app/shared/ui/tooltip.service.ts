import { Injectable, signal } from '@angular/core';

export interface TooltipState {
  visible: boolean;
  label: string;
  info?: string;
  left: number;
  top: number;
  placement: 'left' | 'right';
}

@Injectable({
  providedIn: 'root',
})
export class TooltipService {
  readonly state = signal<TooltipState>({
    visible: false,
    label: '',
    info: '',
    left: 0,
    top: 0,
    placement: 'right',
  });

  private timeout?: any;

  show(
    event: MouseEvent,
    label: string,
    options?: { info?: string; placement?: 'left' | 'right'; customLeft?: number }
  ): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const placement = options?.placement ?? 'right';

    let left = 0;
    if (placement === 'right') {
      left = options?.customLeft ?? (rect.right + 8);
    } else {
      // w-52 is 208px. Subtracting 208px + 8px gap
      left = rect.left - 216;
    }
    const top = rect.top + rect.height / 2;

    this.timeout = setTimeout(() => {
      this.state.set({
        visible: true,
        label,
        info: options?.info ?? '',
        left,
        top,
        placement,
      });
    }, 150);
  }

  hide(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.state.update((s) => ({ ...s, visible: false }));
  }
}
