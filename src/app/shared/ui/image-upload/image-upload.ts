import { Component, inject, input, model, signal } from '@angular/core';

import { ImageUploadService } from '../../../core/api/image-upload.service';
import { ToastService } from '../toast/toast.service';

/**
 * Reusable image upload control. Two-way binds the stored image URL via [(value)].
 * Click to pick a file → uploads → emits the saved URL. Shows preview + progress.
 *
 *   <app-image-upload [(value)]="logoUrl" entityType="Brand" entitySubType="Logo" />
 */
@Component({
  selector: 'app-image-upload',
  templateUrl: './image-upload.html',
})
export class ImageUpload {
  private readonly uploader = inject(ImageUploadService);
  private readonly toast = inject(ToastService);

  /** The stored image URL (two-way bound). */
  readonly value = model<string>('');
  readonly entityType = input<string>('');
  readonly entitySubType = input<string>('');
  readonly label = input<string>('Image');
  readonly accept = input<string>('image/*');

  readonly uploading = signal(false);
  readonly progress = signal(0);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.error('Please choose an image file.');
      return;
    }

    this.uploading.set(true);
    this.progress.set(0);
    this.uploader
      .upload(file, { entityType: this.entityType(), entitySubType: this.entitySubType() })
      .subscribe({
        next: (p) => {
          this.progress.set(p.progress);
          if (p.done) {
            this.uploading.set(false);
            if (p.url) {
              this.value.set(p.url);
              this.toast.success('Image uploaded.');
            } else {
              this.toast.error('Upload finished but no URL was returned.');
            }
          }
        },
        error: () => this.uploading.set(false),
      });

    input.value = ''; // allow re-selecting the same file
  }

  clear(): void {
    this.value.set('');
  }
}
