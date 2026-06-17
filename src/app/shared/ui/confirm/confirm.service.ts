import { Injectable, signal } from '@angular/core';

interface ConfirmState {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  ask(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
    return new Promise((resolve) => {
      this.state.set({
        message,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        danger: opts.danger ?? false,
        resolve,
      });
    });
  }

  respond(ok: boolean): void {
    const s = this.state();
    if (s) {
      s.resolve(ok);
      this.state.set(null);
    }
  }
}
