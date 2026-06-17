import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** A saved template document for a given type. */
export interface TemplateDoc {
  templateId: number;
  template: string;
  isActive: boolean;
}

/** Insertable merge-field token shown in the editor toolbar. */
export interface TemplatePlaceholder {
  name: string;
  tag: string;
}

/**
 * Data source for the reusable TemplateEditor. Implemented by both the
 * invoice and order template services so the same editor drives either one.
 */
export interface TemplateProvider {
  getTemplate(type: string): Observable<TemplateDoc>;
  saveTemplate(type: string, templateId: number, html: string): Observable<unknown>;
}

export const TEMPLATE_PROVIDER = new InjectionToken<TemplateProvider>('TEMPLATE_PROVIDER');
