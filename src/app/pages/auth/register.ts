import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, RegisterRequest } from '../../core/auth.service';
import { errorMessage, fieldErrors } from '../../core/errors';
import { TranslatePipe, translate } from '../../core/i18n/i18n';
import { LangSwitch } from '../../shared/lang-switch';

type Mode = 'invite' | 'create';

/** Template #2 (floor/apartment and entrance name/address are separate fields to match the API). */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, LangSwitch],
  template: `
    <div class="center-page">
      <app-lang-switch class="corner-lang" />
      <div class="center-card" style="max-width:440px">
        <div class="logo" style="margin-bottom:28px">
          <div class="logo-icon">E</div>
          <h1>{{ 'register.title' | t }}</h1>
          <p class="subtitle">{{ 'register.subtitle' | t }}</p>
        </div>

        @if (error()) {
          <div class="form-error" role="alert">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="row">
            <div class="form-group">
              <label for="firstName">{{ 'register.firstName' | t }}</label>
              <input id="firstName" formControlName="firstName" autocomplete="given-name" />
              @if (errors()['firstName']; as e) { <div class="field-error">{{ e }}</div> }
            </div>
            <div class="form-group">
              <label for="lastName">{{ 'register.lastName' | t }}</label>
              <input id="lastName" formControlName="lastName" autocomplete="family-name" />
              @if (errors()['lastName']; as e) { <div class="field-error">{{ e }}</div> }
            </div>
          </div>

          <div class="form-group">
            <label for="email">{{ 'login.email' | t }}</label>
            <input type="email" id="email" formControlName="email" placeholder="you@example.com" autocomplete="email" />
            @if (errors()['email']; as e) { <div class="field-error">{{ e }}</div> }
          </div>

          <div class="form-group">
            <label for="password">{{ 'login.password' | t }}</label>
            <input type="password" id="password" formControlName="password" [placeholder]="'register.passwordHint' | t"
                   autocomplete="new-password" />
            @if (errors()['password']; as e) { <div class="field-error">{{ e }}</div> }
          </div>

          <div class="row">
            <div class="form-group">
              <label for="floor">{{ 'common.floor' | t }}</label>
              <input id="floor" formControlName="floor" [placeholder]="'register.floorPh' | t" />
            </div>
            <div class="form-group">
              <label for="apartment">{{ 'common.apartment' | t }}</label>
              <input id="apartment" formControlName="apartment" [placeholder]="'register.aptPh' | t" />
            </div>
          </div>

          <p class="label" style="margin-bottom:10px">{{ 'register.how' | t }}</p>
          <div class="choice-cards">
            <button type="button" class="choice-card" [class.active]="mode() === 'invite'" (click)="mode.set('invite')">
              <strong>{{ 'register.joinCode' | t }}</strong>
              <span>{{ 'register.joinCodeSub' | t }}</span>
            </button>
            <button type="button" class="choice-card" [class.active]="mode() === 'create'" (click)="mode.set('create')">
              <strong>{{ 'register.createEntrance' | t }}</strong>
              <span>{{ 'register.createEntranceSub' | t }}</span>
            </button>
          </div>

          @if (mode() === 'invite') {
            <div class="form-group">
              <label for="inviteCode">{{ 'register.inviteCode' | t }}</label>
              <input id="inviteCode" formControlName="inviteCode" placeholder="e.g. LKAZAR6N"
                     style="text-transform:uppercase;letter-spacing:0.05em" />
            </div>
          } @else {
            <div class="form-group">
              <label for="entranceName">{{ 'register.entranceName' | t }}</label>
              <input id="entranceName" formControlName="entranceName" [placeholder]="'register.entranceNamePh' | t" />
            </div>
            <div class="form-group">
              <label for="entranceAddress">{{ 'register.address' | t }}</label>
              <input id="entranceAddress" formControlName="entranceAddress" [placeholder]="'register.addressPh' | t" />
            </div>
          }

          <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px" [disabled]="loading()">
            {{ (loading() ? 'register.submitting' : 'register.submit') | t }}
          </button>
        </form>

        <div class="links">{{ 'register.haveAccount' | t }} <a routerLink="/login">{{ 'register.signIn' | t }}</a></div>
      </div>
    </div>
  `,
  styles: `
    .choice-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .choice-card {
      border: 2px solid var(--border); border-radius: 10px; padding: 16px; text-align: center;
      cursor: pointer; transition: all 0.15s; background: white;
    }
    .choice-card:hover { border-color: #93c5fd; }
    .choice-card.active { border-color: var(--primary); background: #eff6ff; }
    .choice-card strong { display: block; margin-bottom: 4px; font-size: 0.95rem; }
    .choice-card span { font-size: 0.8rem; color: var(--muted); }
    #inviteCode::placeholder { text-transform: none; letter-spacing: normal; }
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<Mode>('invite');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    floor: ['', Validators.required],
    apartment: ['', Validators.required],
    inviteCode: [''],
    entranceName: [''],
    entranceAddress: [''],
  });

  protected submit(): void {
    const v = this.form.getRawValue();
    const missing =
      this.form.invalid ||
      (this.mode() === 'invite' ? !v.inviteCode.trim() : !v.entranceName.trim() || !v.entranceAddress.trim());
    if (missing) {
      this.error.set(
        this.form.controls.password.hasError('minlength')
          ? translate('register.passwordShort')
          : translate('register.fillAll'),
      );
      return;
    }

    const req: RegisterRequest = {
      email: v.email,
      password: v.password,
      firstName: v.firstName,
      lastName: v.lastName,
      floor: v.floor,
      apartment: v.apartment,
      ...(this.mode() === 'invite'
        ? { inviteCode: v.inviteCode.replace(/[\s-]/g, '').toUpperCase() }
        : { newEntrance: { name: v.entranceName, address: v.entranceAddress } }),
    };

    this.loading.set(true);
    this.error.set(null);
    this.errors.set({});
    this.auth.register(req).subscribe({
      next: () => this.router.navigateByUrl(this.auth.homeUrl()),
      error: (e) => {
        this.loading.set(false);
        this.errors.set(fieldErrors(e));
        this.error.set(errorMessage(e));
      },
    });
  }
}
