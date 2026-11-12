import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable, from, map, switchMap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

export interface UploadProgress {
  progress: number; // 0-100
  url?: string; // set when complete
  done: boolean;
}

export interface UploadOptions {
  entityType?: string;
  entitySubType?: string;
  imageName?: string;
}

/**
 * Uploads an image file (multipart/form-data) to the gateway upload endpoint
 * and reports progress. The bearer token is attached by authInterceptor.
 *
 * NOTE: endpoint path is environment.uploadPath; field names + response shape
 * are best-effort until confirmed against the real gateway API.
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly url = `${environment.apiUrl.replace(/\/$/, '')}/frontend/UploadImages`;

  /** Longest side after resizing (px). Product photos rarely need more on screen. */
  private static readonly MAX_DIMENSION = 1600;
  /** Files at or below this size are uploaded untouched. */
  private static readonly SKIP_BELOW_BYTES = 300 * 1024;
  private static readonly JPEG_QUALITY = 0.82;

  /**
   * Downscales and re-encodes a photo in the browser before upload. SVG and GIF are left alone
   * (vector / animation), small files are skipped, and if the result isn't smaller the original is used.
   * Photos become JPEG; PNGs with transparency stay PNG (resized only). Never throws — falls back to the original.
   */
  async compress(file: File): Promise<File> {
    try {
      if (!/^image\/(jpeg|png|webp|bmp)$/i.test(file.type)) return file;
      if (file.size <= ImageUploadService.SKIP_BELOW_BYTES) return file;

      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, ImageUploadService.MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      const mayHaveAlpha = /^image\/(png|webp)$/i.test(file.type);
      let keepPng = false;
      if (mayHaveAlpha) {
        ctx.drawImage(bitmap, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h).data;
        for (let i = 3; i < px.length; i += 4) {
          if (px[i] < 255) { keepPng = true; break; }
        }
      }
      if (!keepPng) {
        ctx.fillStyle = '#ffffff'; // JPEG has no alpha — flatten onto white
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();

      const mime = keepPng ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, ImageUploadService.JPEG_QUALITY),
      );
      if (!blob || blob.size >= file.size) return file;

      const base = file.name.replace(/\.[^.]+$/, '');
      return new File([blob], `${base}.${keepPng ? 'png' : 'jpg'}`, { type: mime, lastModified: Date.now() });
    } catch {
      return file;
    }
  }

  upload(file: File, opts: UploadOptions = {}): Observable<UploadProgress> {
    return from(this.compress(file)).pipe(switchMap((f) => this.send(f, opts)));
  }

  private send(file: File, opts: UploadOptions): Observable<UploadProgress> {
    const typeValue = this.getType(opts.entityType);
    const companyIdValue = String(this.auth.companyId());

    console.log('Uploading image via frontend/UploadImages:', {
      url: this.url,
      companyId: companyIdValue,
      type: typeValue,
      fileName: file.name,
      fileSize: file.size
    });

    const form = new FormData();
    form.append('CompanyId', companyIdValue);
    form.append('Type', String(typeValue));
    form.append('Files', file, file.name);

    return this.http
      .post(this.url, form, { reportProgress: true, observe: 'events' })
      .pipe(
        map((event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
            return { progress, done: false };
          }
          if (event.type === HttpEventType.Response) {
            console.log('Upload response body:', event.body);
            return { progress: 100, done: true, url: this.extractUrl(event.body) };
          }
          return { progress: 0, done: false };
        }),
      );
  }

  getType(entityType?: string): number {
    const t = (entityType ?? '').toLowerCase();
    if (t.startsWith('review')) return 1;
    if (t.startsWith('return')) return 2;
    if (t.startsWith('product') || t === 'item') return 3;
    if (t.startsWith('category')) return 4;
    if (t.startsWith('brand')) return 5;
    if (t.startsWith('profile') || t.startsWith('user')) return 6;
    if (t.startsWith('banner')) return 7;
    if (t.startsWith('reel')) return 8;
    if (t.startsWith('offer')) return 9;
    return 99; // default to Other
  }

  /** Extract URL from new Data response envelope with fallbacks */
  private extractUrl(body: unknown): string {
    if (!body) return '';
    const res = body as any;
    
    // Handle lowercase "data" array (e.g. data: [{ url: '...' }])
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data[0].url ?? '';
    }
    
    // Handle uppercase "Data" array (e.g. Data: [{ Url: '...' }])
    if (res.Data && Array.isArray(res.Data) && res.Data.length > 0) {
      return res.Data[0].Url ?? '';
    }
    
    const data = res.data ?? res.Data ?? res;
    if (typeof data === 'string') return data;
    const d = data as Record<string, unknown>;
    return (
      (d['imagePath'] as string) ||
      (d['url'] as string) ||
      (d['fileName'] as string) ||
      (d['filePath'] as string) ||
      ''
    );
  }
}
