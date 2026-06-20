import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { TabItem } from '../../../shared/ui/tabs/tabs';
import { Modal } from '../../../shared/ui/modal/modal';
import { DataTable, Column } from '../../../shared/ui/data-table/data-table';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ConfirmService } from '../../../shared/ui/confirm/confirm.service';
import { TemplatesService } from './templates.service';
import { CompanyTemplate, CustomGroup, FrontendTemplate } from './template.models';

@Component({
  selector: 'app-templates-page',
  imports: [ReactiveFormsModule, Modal, DataTable, ImageUpload],
  templateUrl: './templates.page.html',
})
export class TemplatesPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TemplatesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  /** Open the storefront builder for a template. */
  configure(template: CompanyTemplate): void {
    this.router.navigate(['/settings/templates', template.companyTemplateId]);
  }

  readonly tabs: TabItem[] = [
    { id: 'templates', label: 'Template List' },
    { id: 'groups', label: 'Custom Group' },
  ];
  readonly active = signal('templates');

  // --- Template List ---
  readonly templates = signal<CompanyTemplate[]>([]);
  readonly templatesLoading = signal(false);
  readonly galleryOpen = signal(false);
  readonly frontendTemplates = signal<FrontendTemplate[]>([]);
  readonly frontendLoading = signal(false);

  // --- Custom Groups ---
  readonly groups = signal<CustomGroup[]>([]);
  readonly groupsLoading = signal(false);
  readonly groupModalOpen = signal(false);
  readonly editingGroupId = signal(0);
  readonly savingGroup = signal(false);

  readonly groupColumns: Column<CustomGroup>[] = [
    { key: 'customGroupName', header: 'Group name' },
    { key: 'isActive', header: 'Status', align: 'center', format: (g) => (g.isActive ? 'Active' : 'Inactive') },
  ];

  readonly groupForm = this.fb.nonNullable.group({
    customGroupName: ['', [Validators.required]],
    customGroupImageLink: [''],
    isActive: [true],
  });

  constructor() {
    this.loadTemplates();
    this.loadGroups();
  }

  // --- Template List ---
  loadTemplates(): void {
    this.templatesLoading.set(true);
    this.service.listCompanyTemplates().subscribe({
      next: (rows) => {
        this.templates.set(rows ?? []);
        this.templatesLoading.set(false);
      },
      error: () => this.templatesLoading.set(false),
    });
  }

  openGallery(): void {
    this.galleryOpen.set(true);
    if (!this.frontendTemplates().length) {
      this.frontendLoading.set(true);
      this.service.listFrontendTemplates().subscribe({
        next: (rows) => {
          this.frontendTemplates.set(rows ?? []);
          this.frontendLoading.set(false);
        },
        error: () => this.frontendLoading.set(false),
      });
    }
  }

  addTemplate(master: FrontendTemplate): void {
    this.service.addTemplate(master.templateId).subscribe({
      next: () => {
        this.toast.success('Template added.');
        this.galleryOpen.set(false);
        this.loadTemplates();
      },
    });
  }

  async setDefault(template: CompanyTemplate): Promise<void> {
    if (template.isDefault) return;
    const ok = await this.confirm.ask(`Make "${template.templateName}" the default storefront template?`, {
      confirmLabel: 'Set default',
    });
    if (!ok) return;
    this.service.setDefault(template).subscribe({
      next: () => {
        this.toast.success('Default template updated.');
        this.loadTemplates();
      },
    });
  }

  // --- Custom Groups ---
  loadGroups(): void {
    this.groupsLoading.set(true);
    this.service.listCustomGroups().subscribe({
      next: (rows) => {
        this.groups.set(rows ?? []);
        this.groupsLoading.set(false);
      },
      error: () => this.groupsLoading.set(false),
    });
  }

  openCreateGroup(): void {
    this.editingGroupId.set(0);
    this.groupForm.reset({ customGroupName: '', customGroupImageLink: '', isActive: true });
    this.groupModalOpen.set(true);
  }

  openEditGroup(group: CustomGroup): void {
    this.editingGroupId.set(group.customGroupId);
    this.groupForm.reset({
      customGroupName: group.customGroupName,
      customGroupImageLink: group.customGroupImageLink ?? '',
      isActive: group.isActive,
    });
    this.groupModalOpen.set(true);
  }

  saveGroup(): void {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      return;
    }
    this.savingGroup.set(true);
    const v = this.groupForm.getRawValue();
    this.service
      .saveCustomGroup({
        customGroupId: this.editingGroupId(),
        customGroupName: v.customGroupName,
        customGroupImageLink: v.customGroupImageLink,
        isActive: v.isActive,
      })
      .subscribe({
        next: () => {
          this.savingGroup.set(false);
          this.groupModalOpen.set(false);
          this.toast.success(this.editingGroupId() ? 'Group updated.' : 'Group created.');
          this.loadGroups();
        },
        error: () => this.savingGroup.set(false),
      });
  }

  getDefaultTemplateName(): string {
    const def = this.templates().find((t) => t.isDefault);
    return def ? def.templateName : 'None';
  }

  getActiveGroupsCount(): number {
    return this.groups().filter((g) => g.isActive).length;
  }
}
