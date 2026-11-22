import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/i18n';

/** Template #5. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="center-page">
      <div class="center-card text-center" style="max-width:380px">
        <div class="code">404</div>
        <h1 style="font-size:1.35rem;margin-bottom:12px">{{ 'notFound.title' | t }}</h1>
        <p class="lead" style="margin-bottom:28px">{{ 'notFound.body' | t }}</p>
        <a routerLink="/" class="btn btn-primary">{{ 'notFound.home' | t }}</a>
      </div>
    </div>
  `,
  styles: `.code { font-size: 4rem; font-weight: 800; color: #e2e8f0; line-height: 1; margin-bottom: 8px; }`,
})
export class NotFoundPage {}
