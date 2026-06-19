import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);

  handleError(error: any): void {
    // Standard console log for debugging
    console.error('Unhandled Application Error:', error);

    // Extract the message
    let message = 'An unexpected error occurred.';
    if (error instanceof Error) {
      message = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      message = String(error.message);
    } else if (error) {
      message = String(error);
    }

    // Surface business/API errors or shorter system errors as a toast
    const isApiError = error?.name === 'ApiError' || String(error).includes('ApiError');
    if (isApiError || message.length < 150) {
      const cleanMessage = message.replace(/^ApiError:\s*/i, '');
      this.toast.error(cleanMessage);
    }
  }
}
