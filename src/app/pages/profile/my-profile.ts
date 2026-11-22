import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { NotificationSettings } from '../../core/models';
import { PushService } from '../../core/push.service';
import { Avatar } from '../../shared/avatar';
import { ToastService } from '../../shared/toast.service';
import { I18nKey, TranslatePipe, translate } from '../../core/i18n/i18n';
import { LangSwitch } from '../../shared/lang-switch';

type SettingKey = keyof NotificationSettings;

/** Template #15. */
@Component({
  selector: 'app-my-profile',
  imports: [Avatar, ReactiveFormsModule, RouterLink, TranslatePipe, LangSwitch],
  template: `
    <div class="card profile-edit">
      <div class="avatar-edit">
        <app-avatar [person]="auth.user()" [size]="90" />
        <label class="change">
          {{ (uploading() ? 'me.uploading' : 'me.changePhoto') | t }}
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden (change)="changeAvatar($event)"
                 [disabled]="uploading()" />
        </label>
        <div class="muted" style="font-size:0.85rem">{{ auth.user()?.email }}</div>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()">
        <div class="row">
          <div class="form-group">
            <label for="fn">{{ 'register.firstName' | t }}</label>
            <input id="fn" formControlName="firstName" />
          </div>
          <div class="form-group">
            <label for="ln">{{ 'register.lastName' | t }}</label>
            <input id="ln" formControlName="lastName" />
          </div>
        </div>
        <div class="row">
          <div class="form-group">
            <label for="fl">{{ 'common.floor' | t }}</label>
            <input id="fl" formControlName="floor" />
          </div>
          <div class="form-group">
            <label for="ap">{{ 'common.apartment' | t }}</label>
            <input id="ap" formControlName="apartment" />
          </div>
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="form.invalid || form.pristine || saving()">
          {{ (saving() ? 'common.saving' : 'common.save') | t }}
        </button>
      </form>

      <div class="settings-section">
        <div class="setting-item">
          <span>🌐 {{ 'me.language' | t }}</span>
          <app-lang-switch />
        </div>
      </div>

      <div class="settings-section">
        <h3>{{ 'me.notifications' | t }}</h3>
        @for (s of settingRows; track s.key) {
          <div class="setting-item" [class.dim]="s.key !== 'pushEnabled' && !settings()?.pushEnabled">
            <span>{{ s.label | t }}</span>
            <button class="toggle" [class.on]="settings()?.[s.key]" (click)="toggle(s.key)" [disabled]="!settings()"
                    role="switch" [attr.aria-checked]="settings()?.[s.key]" [attr.aria-label]="s.label | t"></button>
          </div>
        }
        <p class="muted hint">{{ 'me.pushHint' | t }}</p>
      </div>

      @if (auth.isAdmin()) {
        <a routerLink="/admin" class="btn btn-secondary btn-block" style="margin-top:24px">{{ 'me.adminMembers' | t }}</a>
        <a routerLink="/billing" class="btn btn-secondary btn-block" style="margin-top:10px">{{ 'me.subscription' | t }}</a>
      }
      <button class="logout-btn" (click)="auth.logout()">{{ 'me.logout' | t }}</button>
    </div>
  `,
  styles: `
    .profile-edit { padding: 24px; }
    .avatar-edit { text-align: center; margin-bottom: 24px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .change { color: var(--primary); font-weight: 600; font-size: 0.9rem; cursor: pointer; }
    .settings-section { margin-top: 28px; }
    .settings-section h3 { font-size: 0.85rem; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; letter-spacing: 0.03em; }
    .setting-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid var(--border); font-size: 0.95rem; }
    .setting-item.dim span { opacity: 0.5; }
    .toggle { width: 48px; height: 28px; background: #cbd5e1; border-radius: 14px; position: relative; cursor: pointer; border: none; flex-shrink: 0; transition: background 0.2s; }
    .toggle.on { background: var(--primary); }
    .toggle::after { content: ""; position: absolute; width: 22px; height: 22px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: 0.2s; }
    .toggle.on::after { left: 23px; }
    .hint { font-size: 0.8rem; margin-top: 10px; }
    .logout-btn { width: 100%; margin-top: 16px; padding: 13px; background: #fef2f2; color: var(--error); border: none; border-radius: 8px; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
  `,
})
export class MyProfilePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly push = inject(PushService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly settingRows: { key: SettingKey; label: I18nKey }[] = [
    { key: 'pushEnabled', label: 'me.push' },
    { key: 'newMessages', label: 'me.newMessages' },
    { key: 'newPolls', label: 'me.newPolls' },
    { key: 'newPosts', label: 'me.newPosts' },
  ];
  protected readonly settings = signal<NotificationSettings | null>(null);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    floor: ['', [Validators.required, Validators.maxLength(10)]],
    apartment: ['', [Validators.required, Validators.maxLength(10)]],
  });

  ngOnInit(): void {
    const u = this.auth.user();
    if (u) this.form.reset({ firstName: u.firstName, lastName: u.lastName, floor: u.floor, apartment: u.apartment });
    this.api.notificationSettings().subscribe({ next: (s) => this.settings.set(s), error: () => undefined });
  }

  protected save(): void {
    this.saving.set(true);
    this.api.updateMe(this.form.getRawValue()).subscribe({
      next: (u) => {
        this.auth.user.set(u);
        this.form.reset({ firstName: u.firstName, lastName: u.lastName, floor: u.floor, apartment: u.apartment });
        this.saving.set(false);
        this.toast.success(translate('me.saved'));
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected changeAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.api.updateAvatar(file).subscribe({
      next: (u) => {
        this.auth.user.set(u);
        this.uploading.set(false);
        this.toast.success(translate('me.photoUpdated'));
      },
      error: (e) => {
        this.uploading.set(false);
        this.toast.error(errorMessage(e, 'me.photoFailed'));
      },
    });
  }

  protected async toggle(key: SettingKey): Promise<void> {
    const current = this.settings();
    if (!current) return;
    const next = { ...current, [key]: !current[key] };

    if (key === 'pushEnabled') {
      if (next.pushEnabled) {
        const problem = await this.push.enable();
        if (problem) this.toast.info(translate(problem));
      } else {
        await this.push.disable();
      }
    }

    this.settings.set(next);
    this.api.updateNotificationSettings(next).subscribe({
      next: (s) => this.settings.set(s),
      error: (e) => {
        this.settings.set(current);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
