import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ToastService } from '../../../shared/ui/toast/toast.service';
import { SocialService } from './social.service';

interface Channel {
  value: string; // form control name for the value
  show: string; // form control name for the show-online toggle
  label: string;
  placeholder: string;
}

@Component({
  selector: 'app-social-page',
  imports: [ReactiveFormsModule],
  templateUrl: './social.page.html',
})
export class SocialPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SocialService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  private readonly socialLinkId = signal(0);
  private readonly createdAt = signal<string | undefined>(undefined);

  readonly channels: Channel[] = [
    { value: 'facebook', show: 'showFacebookOnline', label: 'Facebook', placeholder: 'https://facebook.com/yourpage' },
    { value: 'instagram', show: 'showInstagramOnline', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
    { value: 'twitter', show: 'showTwitterOnline', label: 'Twitter / X', placeholder: 'https://x.com/yourhandle' },
    { value: 'contactEmail', show: 'showContactEmailOnline', label: 'Contact Email', placeholder: 'support@store.com' },
    { value: 'contactPhone', show: 'showContactPhoneOnline', label: 'Contact Phone', placeholder: '+1 555 000 0000' },
  ];

  readonly form = this.fb.nonNullable.group({
    isActive: [true],
    facebook: [''],
    showFacebookOnline: [false],
    instagram: [''],
    showInstagramOnline: [false],
    twitter: [''],
    showTwitterOnline: [false],
    contactEmail: [''],
    showContactEmailOnline: [false],
    contactPhone: [''],
    showContactPhoneOnline: [false],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.get().subscribe({
      next: (s) => {
        if (s) {
          this.socialLinkId.set(s.companySocialLinkId ?? 0);
          this.createdAt.set(s.createdAt);
          this.form.patchValue({
            isActive: s.isActive ?? true,
            facebook: s.facebook ?? '',
            showFacebookOnline: !!s.showFacebookOnline,
            instagram: s.instagram ?? '',
            showInstagramOnline: !!s.showInstagramOnline,
            twitter: s.twitter ?? '',
            showTwitterOnline: !!s.showTwitterOnline,
            contactEmail: s.contactEmail ?? '',
            showContactEmailOnline: !!s.showContactEmailOnline,
            contactPhone: s.contactPhone ?? '',
            showContactPhoneOnline: !!s.showContactPhoneOnline,
          });
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    this.saving.set(true);
    this.service
      .save({ companySocialLinkId: this.socialLinkId(), createdAt: this.createdAt(), ...this.form.getRawValue() })
      .subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Social links saved.');
      },
      error: () => this.saving.set(false),
    });
  }
}
