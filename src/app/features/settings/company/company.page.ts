import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Checkbox } from '../../../shared/ui/checkbox/checkbox';
import { ImageUpload } from '../../../shared/ui/image-upload/image-upload';
import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { CompanyService } from './company.service';
import { BusinessUnits } from './business-units';
import { CompanyInfo } from './company.models';

@Component({
  selector: 'app-company-page',
  imports: [ReactiveFormsModule, Checkbox, ImageUpload, Tabs, BusinessUnits],
  templateUrl: './company.page.html',
})
export class CompanyPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CompanyService);
  private readonly toast = inject(ToastService);

  readonly tabs: TabItem[] = [
    { id: 'company', label: 'Company' },
    { id: 'units', label: 'Business Unit Configuration' },
  ];
  readonly activeTab = signal('company');

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly company = signal<CompanyInfo | null>(null);

  // Image file names (two-way bound to the uploaders / preview)
  readonly logoFileName = signal('');
  readonly favIconFileName = signal('');
  readonly footerFileName = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    address1: [''],
    address2: [''],
    pin: [''],
    districtCode: [''],
    stateCode: [''],
    adminPhone: ['', [Validators.required]],
    servicePhone: [''],
    adminEmail: ['', [Validators.required]],
    serviceEmail: [''],
    secondaryEmail: [''],
    gstNumber: [''],
    panNumber: [''],
    website: [''],
    pinRequired: [false],
    isActive: [true],
    otpRequired: [false],
    otpCOD: [false],
    otpOnlinePayment: [false],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.get().subscribe({
      next: (c) => {
        this.company.set(c);
        this.logoFileName.set(c.logoFileName);
        this.favIconFileName.set(c.favIconFileName);
        this.footerFileName.set(c.footerFileName);
        this.form.reset({
          name: c.name,
          address1: c.address1,
          address2: c.address2,
          pin: c.pin,
          districtCode: c.districtCode,
          stateCode: c.stateCode,
          adminPhone: c.adminPhone,
          servicePhone: c.servicePhone,
          adminEmail: c.adminEmail,
          serviceEmail: c.serviceEmail,
          secondaryEmail: c.secondaryEmail,
          gstNumber: c.gstNumber,
          panNumber: c.panNumber,
          website: c.website,
          pinRequired: c.pinRequired,
          isActive: c.isActive,
          otpRequired: c.otpRequired,
          otpCOD: c.otpCOD,
          otpOnlinePayment: c.otpOnlinePayment,
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Build a preview URL for an image filename against the company base path. */
  previewUrl(fileName: string): string {
    const base = this.company()?.imageFilePath ?? '';
    return fileName ? `${base}${fileName}` : '';
  }

  save(): void {
    const base = this.company();
    if (!base) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fill in the required fields.');
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.service
      .save({
        ...base,
        name: v.name,
        address1: v.address1,
        address2: v.address2,
        pin: v.pin,
        districtCode: v.districtCode,
        stateCode: v.stateCode,
        adminPhone: v.adminPhone,
        servicePhone: v.servicePhone,
        adminEmail: v.adminEmail,
        serviceEmail: v.serviceEmail,
        secondaryEmail: v.secondaryEmail,
        gstNumber: v.gstNumber,
        panNumber: v.panNumber,
        website: v.website,
        logoFileName: this.logoFileName(),
        favIconFileName: this.favIconFileName(),
        footerFileName: this.footerFileName(),
        pinRequired: v.pinRequired,
        isActive: v.isActive,
        otpRequired: v.otpRequired,
        otpCOD: v.otpCOD,
        otpOnlinePayment: v.otpOnlinePayment,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Company details saved.');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }
}
