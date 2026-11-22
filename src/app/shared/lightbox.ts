import { Component, HostListener, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LightboxService {
  readonly url = signal<string | null>(null);

  open(url: string): void {
    this.url.set(url);
  }

  close(): void {
    this.url.set(null);
  }
}

/** Full-screen image viewer (one instance in the root component). */
@Component({
  selector: 'app-lightbox',
  template: `
    @if (lightbox.url(); as url) {
      <div class="lightbox" (click)="lightbox.close()">
        <button class="close" aria-label="Close">✕</button>
        <img [src]="url" alt="" />
      </div>
    }
  `,
  styles: `
    .lightbox {
      position: fixed; inset: 0; z-index: 500; background: rgba(0, 0, 0, 0.9);
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px; }
    .close {
      position: absolute; top: 16px; right: 16px; width: 40px; height: 40px; border-radius: 50%;
      border: none; background: rgba(255, 255, 255, 0.15); color: white; font-size: 18px; cursor: pointer;
    }
  `,
})
export class Lightbox {
  protected readonly lightbox = inject(LightboxService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.lightbox.close();
  }
}
