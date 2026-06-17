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
  private readonly url = `${environment.apiUrl.replace(/\/$/, '')}/${environment.uploadPath}`;

  upload(file: File, opts: UploadOptions = {}): Observable<UploadProgress> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('CompanyId', String(this.auth.companyId()));
    if (opts.entityType) form.append('EntityType', opts.entityType);
    if (opts.entitySubType) form.append('EntitySubType', opts.entitySubType);
    if (opts.imageName) form.append('ImageName', opts.imageName);

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

  /** Best-effort URL extraction from the response envelope. Adjust once confirmed. */
  private extractUrl(body: unknown): string {
    if (!body) return '';
    if (typeof body === 'string') return body;
    const data = (body as { data?: unknown }).data ?? body;
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
