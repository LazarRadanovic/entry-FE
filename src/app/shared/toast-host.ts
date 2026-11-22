import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="t.kind" (click)="toast.dismiss(t.id)">{{ t.text }}</div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed; left: 50%; transform: translateX(-50%); z-index: 600;
      bottom: calc(var(--bottomnav-height) + 16px); display: flex; flex-direction: column; gap: 8px;
      width: min(420px, calc(100% - 32px));
    }
    @media (min-width: 900px) { .toasts { bottom: 24px; } }
    .toast {
      background: var(--text); color: white; padding: 12px 16px; border-radius: 10px;
      font-size: 0.9rem; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); cursor: pointer;
      animation: up 0.2s ease;
    }
    .toast.error { background: var(--error); }
    .toast.success { background: var(--success); }
    @keyframes up { from { transform: translateY(8px); opacity: 0; } }
  `,
})
export class ToastHost {
  protected readonly toast = inject(ToastService);
}
