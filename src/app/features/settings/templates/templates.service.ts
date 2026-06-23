import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CompanyTemplate, CustomGroup, FrontendTemplate } from './template.models';
import { ItemImage, SectionMetadata, SectionProductResult, TemplateDetail, TemplateSection } from './builder.models';

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  // --- Template List (CompanyManagement) ---
  listCompanyTemplates(): Observable<CompanyTemplate[]> {
    return this.api.post<CompanyTemplate[]>('CompanyManagement/GetCompanyTemplateList', {
      CompanyId: this.auth.companyId(),
    });
  }

  /** Available frontend template masters the company can add. */
  listFrontendTemplates(): Observable<FrontendTemplate[]> {
    return this.api.get<FrontendTemplate[]>('CompanyManagement/GetFrontendTemplate');
  }

  addTemplate(templateId: number, isForB2C = true): Observable<unknown> {
    return this.api.post('CompanyManagement/AddCompanyTemplate', {
      TemplateId: templateId,
      CompanyId: this.auth.companyId(),
      IsForB2C: isForB2C,
    });
  }

  setDefault(template: CompanyTemplate): Observable<unknown> {
    return this.api.post('CompanyManagement/ChangeCompanyTemplateDefault', {
      TemplateId: template.templateId,
      CompanyTemplateId: template.companyTemplateId,
      CompanyId: this.auth.companyId(),
      IsForB2C: template.isForB2C,
    });
  }

  // --- Storefront builder ---

  /** Full template detail incl. its sections. */
  getTemplateDetail(companyTemplateId: number): Observable<TemplateDetail> {
    return this.api.post<TemplateDetail>('CompanyManagement/GetCompanyTemplate', {
      CompanyTemplateId: companyTemplateId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }

  /** Update the template master (name, colours, flags, font). */
  saveTemplateMaster(t: {
    companyTemplateId: number;
    templateName: string;
    primaryColor: string;
    secondaryColor: string;
    tertiaryColor: string;
    isActive: boolean;
    isForB2C: boolean;
    fontFamilyId: number | null;
  }): Observable<unknown> {
    return this.api.post('Companymanagement/EditCompanyTemplate', {
      CompanyTemplateId: t.companyTemplateId,
      TemplateName: t.templateName,
      PrimaryColor: t.primaryColor,
      SecondaryColor: t.secondaryColor,
      TertiaryColor: t.tertiaryColor,
      CompanyId: this.auth.companyId(),
      IsActive: t.isActive,
      IsForB2C: t.isForB2C,
      FontFamilyId: t.fontFamilyId,
    });
  }

  /** Master lists (SectionFor + section types) for the create-section form. */
  sectionMetadata(): Observable<SectionMetadata> {
    return this.api.post<SectionMetadata>('Companymanagement/GetTemplateSectionForMetaData', {});
  }

  /** Create or update a section. */
  saveSection(s: {
    companyTemplateId: number;
    companyTemplateSectionId: number;
    sectionName: string;
    sectionFor: number;
    sectionType: number;
    primaryText: string;
    secondaryText: string;
    tertiaryText: string;
    sectionBackgroundColor: string;
    isActive: boolean;
  }): Observable<unknown> {
    return this.api.post('Companymanagement/SaveUpdateCompanyTemplateSectionData', {
      CompanyTemplateId: s.companyTemplateId,
      CompanyTemplateSectionId: s.companyTemplateSectionId,
      SectionName: s.sectionName,
      SectionFor: s.sectionFor,
      SectionType: s.sectionType,
      PrimaryText: s.primaryText,
      SecondaryText: s.secondaryText,
      TertiaryText: s.tertiaryText,
      // NOTE: gateway property is misspelled "SectionBackgrounColor" (no 'd').
      // Sending the correctly-spelled key silently drops the value.
      SectionBackgrounColor: s.sectionBackgroundColor,
      IsActive: s.isActive,
      CompanyId: this.auth.companyId(),
      CreatedBy: this.auth.userId(),
      UpdatedBy: this.auth.userId(),
    });
  }

  /** Persist a new section ordering. Order is implied by array position. */
  reorderSections(orderedSectionIds: number[]): Observable<unknown> {
    return this.api.post('Companymanagement/EditCompanyTemplateSectionOrder', {
      CompanyTemplateSectionIds: orderedSectionIds,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
    });
  }

  deleteSectionImage(imageMappingId: number): Observable<unknown> {
    return this.api.post('Companymanagement/DeleteCompanyTemplateSectionImage', {
      CompanyTemplateSectionImageMappingId: imageMappingId,
      CompanyId: this.auth.companyId(),
    });
  }

  deleteSectionItem(itemMappingId: number): Observable<unknown> {
    return this.api.post('Companymanagement/DeleteCompanyTemplateSectionItem', {
      CompanyTemplateSectionItemMappingId: itemMappingId,
      CompanyId: this.auth.companyId(),
    });
  }

  // --- Add section items ---

  /** Search products/variants for a section (wraps the batch report). */
  searchSectionProducts(term: string, page = 1): Observable<SectionProductResult[]> {
    return this.api
      .post<{ batchReportList?: Record<string, unknown>[] }>('ProductManagement/GetBatchReport', {
        CompanyId: this.auth.companyId(),
        SearchCriteria: term,
        Pagenumber: page,
        RecordPerPage: 50,
        categoryId: '0',
      })
      .pipe(
        map((data) =>
          (data?.batchReportList ?? []).map((r) => ({
            itemId: Number(r['itemId'] ?? 0),
            variantId: Number(r['variantId'] ?? 0),
            name: `${r['name'] ?? ''} ${r['itemCode'] ? '[' + r['itemCode'] + ']' : ''}`.trim(),
            imageUrl: String(r['imageUrl'] ?? ''),
          })),
        ),
      );
  }

  /** All images belonging to an item (for per-item image selection). */
  itemImages(itemId: number): Observable<ItemImage[]> {
    return this.api
      .post<unknown[]>('ProductManagement/GetItemWiseImageList', {
        CompanyId: this.auth.companyId(),
        ItemId: itemId,
      })
      .pipe(
        map((rows) =>
          (rows ?? []).map((r) => {
            const o = r as Record<string, unknown>;
            return {
              imageId: Number(o['imageId'] ?? 0),
              path: String(o['fullImagepath'] ?? o['imageFullPath'] ?? o['imagePath'] ?? ''),
              isPrimary: o['isPrimary'] === true,
            };
          }),
        ),
      );
  }

  /** Add products (SectionFor=1) or variants (SectionFor=2) to a section. */
  addSectionItems(
    companyTemplateSectionId: number,
    sectionFor: number,
    items: { itemId: number; variantId: number; imageUrl: string }[],
  ): Observable<unknown> {
    return this.api.post('Companymanagement/AddSectionItem', {
      CompanyTemplateSectionId: companyTemplateSectionId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      SectionFor: sectionFor,
      RequestCompanyTemplateSectionItems: items.map((i) => ({
        ItemId: i.itemId,
        VariantId: sectionFor === 2 ? i.variantId : 0,
        ItemImage: i.imageUrl,
      })),
    });
  }

  /** Map custom groups (SectionFor=4) to a section. */
  saveSectionCustomGroups(
    companyTemplateSectionId: number,
    groups: { id: number; name: string; imageLink: string }[],
  ): Observable<unknown> {
    return this.api.post('Companymanagement/SaveUpdateCompanyTemplateSectionItemMapping', {
      CompanyTemplateSectionId: companyTemplateSectionId,
      CompanyId: this.auth.companyId(),
      UserId: this.auth.userId(),
      RequestCustomSectionIds: groups.map((g) => ({
        Id: g.id,
        CustomGroupName: g.name,
        CustomGroupImageLink: g.imageLink,
      })),
    });
  }

  // --- Custom Groups (ProductManagement) ---
  listCustomGroups(): Observable<CustomGroup[]> {
    return this.api.post<CustomGroup[]>('ProductManagement/GetCustomGroupforMaster', {
      CompanyId: this.auth.companyId(),
    });
  }

  saveCustomGroup(
    group: Pick<CustomGroup, 'customGroupId' | 'customGroupName' | 'customGroupImageLink' | 'isActive'>,
  ): Observable<unknown> {
    return this.api.post('ProductManagement/SaveUpdateCustomGroup', {
      CustomGroupId: group.customGroupId,
      CustomGroupName: group.customGroupName,
      CustomGroupImageLink: group.customGroupImageLink,
      CompanyId: this.auth.companyId(),
      IsActive: group.isActive,
    });
  }
}
