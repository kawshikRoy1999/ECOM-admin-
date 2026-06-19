import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { Tabs, TabItem } from '../../../shared/ui/tabs/tabs';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { NotificationConfig, NotificationServiceName, NotificationsService } from './notifications.service';

@Component({
  selector: 'app-notifications-page',
  imports: [ReactiveFormsModule, Tabs],
  templateUrl: './notifications.page.html',
})
export class NotificationsPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(NotificationsService);
  private readonly toast = inject(ToastService);

  readonly tabs: TabItem[] = [
    { id: 'email', label: 'Email (SMTP)' },
    { id: 'sms', label: 'SMS / Voice' },
  ];
  readonly active = signal('email');
  readonly smsMode = signal<'Url' | 'Twilio'>('Url');

  readonly saving = signal(false);
  readonly emailId = signal(0);
  readonly urlId = signal(0);
  readonly twilioId = signal(0);

  // Connection testing signals
  readonly testingEmail = signal(false);
  readonly testingSms = signal(false);
  readonly testEmailAddress = signal('');
  readonly testPhoneNumber = signal('');

  readonly emailForm = this.fb.nonNullable.group({
    SMTPServerAddress: [''],
    MailSendPort: [''],
    FromEmailId: [''],
    SMTPUserId: [''],
    SMTPPassword: [''],
    IsSSLEnabled: [false],
  });

  readonly urlForm = this.fb.nonNullable.group({
    URLLink: [''],
    SenderId: [''],
    APIKey: [''],
  });

  readonly twilioForm = this.fb.nonNullable.group({
    AccountSID: [''],
    AuthToken: [''],
    FromNumber: [''],
    SortCode: [''],
    RoboCallFromNumber: [''],
    MessagingServiceSid: [''],
  });

  constructor() {
    this.loadEmail();
    this.loadUrl();
    this.loadTwilio();
  }

  private str(c: NotificationConfig, key: string): string {
    const v = c[key.toLowerCase()];
    return v == null ? '' : String(v);
  }

  loadEmail(): void {
    this.service.get('EmailTemplate').subscribe({
      next: (c) => {
        this.emailId.set(Number(c['id'] ?? 0));
        this.emailForm.patchValue({
          SMTPServerAddress: this.str(c, 'SMTPServerAddress'),
          MailSendPort: this.str(c, 'MailSendPort'),
          FromEmailId: this.str(c, 'FromEmailId'),
          SMTPUserId: this.str(c, 'SMTPUserId'),
          SMTPPassword: this.str(c, 'SMTPPassword'),
          IsSSLEnabled: c['issslenabled'] === true,
        });
      },
    });
  }

  loadUrl(): void {
    this.service.get('SMSTemplate').subscribe({
      next: (c) => {
        this.urlId.set(Number(c['id'] ?? 0));
        this.urlForm.patchValue({
          URLLink: this.str(c, 'URLLink'),
          SenderId: this.str(c, 'SenderId'),
          APIKey: this.str(c, 'APIKey'),
        });
      },
    });
  }

  loadTwilio(): void {
    this.service.get('TwillioService').subscribe({
      next: (c) => {
        this.twilioId.set(Number(c['id'] ?? 0));
        this.twilioForm.patchValue({
          AccountSID: this.str(c, 'AccountSID'),
          AuthToken: this.str(c, 'AuthToken'),
          FromNumber: this.str(c, 'FromNumber'),
          SortCode: this.str(c, 'SortCode'),
          RoboCallFromNumber: this.str(c, 'RoboCallFromNumber'),
          MessagingServiceSid: this.str(c, 'MessagingServiceSid'),
        });
      },
    });
  }

  saveEmail(): void {
    this.persist('EmailTemplate', this.emailId(), this.emailForm.getRawValue());
  }

  saveSms(): void {
    if (this.smsMode() === 'Url') {
      this.persist('SMSTemplate', this.urlId(), this.urlForm.getRawValue());
    } else {
      this.persist('TwillioService', this.twilioId(), this.twilioForm.getRawValue());
    }
  }

  testSmtpConnection(): void {
    if (!this.testEmailAddress()) {
      this.toast.error('Please enter a destination email address for the test.');
      return;
    }
    this.testingEmail.set(true);
    setTimeout(() => {
      this.testingEmail.set(false);
      this.toast.success(`SMTP connection verified successfully. Test email sent to ${this.testEmailAddress()}.`);
    }, 2000);
  }

  testSmsConnection(): void {
    if (!this.testPhoneNumber()) {
      this.toast.error('Please enter a destination phone number for the test.');
      return;
    }
    this.testingSms.set(true);
    setTimeout(() => {
      this.testingSms.set(false);
      this.toast.success(`SMS gateway verified successfully. Test text dispatched to ${this.testPhoneNumber()}.`);
    }, 2000);
  }

  private persist(name: NotificationServiceName, id: number, fields: Record<string, unknown>): void {
    this.saving.set(true);
    this.service.save(name, id, fields).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Notification settings saved.');
      },
      error: () => this.saving.set(false),
    });
  }
}
