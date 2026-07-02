import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Observable, map } from 'rxjs';

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

  upload(file: File, opts: UploadOptions = {}): Observable<UploadProgress> {
    const form = new FormData();
    form.append('Files', file, file.name);
    form.append('CompanyId', String(this.auth.companyId()));
    form.append('Type', String(this.getType(opts.entityType)));

    return this.http
      .post(this.url, form, { reportProgress: true, observe: 'events' })
      .pipe(
        map((event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
            return { progress, done: false };
          }
          if (event.type === HttpEventType.Response) {
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
    if (res.Data && Array.isArray(res.Data) && res.Data.length > 0) {
      return res.Data[0].Url ?? '';
    }
    const data = res.data ?? res;
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
