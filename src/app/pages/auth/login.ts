import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { LangSwitch } from '../../shared/lang-switch';

/** Template #1. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, LangSwitch],
  template: `
    <div class="center-page">
      <app-lang-switch class="corner-lang" />
      <div class="center-card">
        <div class="logo">
          <div class="logo-icon">E</div>
          <h1>{{ 'login.title' | t }}</h1>
          <p class="subtitle">{{ 'login.subtitle' | t }}</p>
        </div>

        @if (error()) {
          <div class="form-error" role="alert">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-group">
            <label for="email">{{ 'login.email' | t }}</label>
            <input type="email" id="email" formControlName="email" placeholder="you@example.com" autocomplete="email" />
          </div>
          <div class="form-group">
            <label for="password">{{ 'login.password' | t }}</label>
            <input type="password" id="password" formControlName="password" placeholder="••••••••"
                   autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
            {{ (loading() ? 'login.submitting' : 'login.submit') | t }}
          </button>
        </form>

        <div class="links">
          {{ 'login.noAccount' | t }} <a routerLink="/register">{{ 'login.create' | t }}</a>
        </div>
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.error.set(translate('login.missing'));
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homeUrl()),
      error: (e) => {
        this.loading.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
