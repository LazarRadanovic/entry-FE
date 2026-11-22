import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/errors';
import { FileDto } from '../../core/models';
import { ToastService } from '../../shared/toast.service';
import { TranslatePipe, translate } from '../../core/i18n/i18n';

interface Pending {
  key: number;
  preview: string;
  uploaded: FileDto | null;
  failed: boolean;
}

const MAX_IMAGES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

/** Template #9. Images upload as soon as they are picked; Publish sends their ids. */
@Component({
  selector: 'app-create-post',
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="card create-post">
      <h1>{{ 'create.title' | t }}</h1>

      <div class="form-group">
        <label for="text">{{ 'create.mind' | t }}</label>
        <textarea id="text" [(ngModel)]="text" [placeholder]="'create.placeholder' | t" maxlength="2000"></textarea>
      </div>

      <div class="form-group">
        <label>{{ 'create.photos' | t }}</label>
        @if (images().length < max) {
          <label class="add-photos">
            {{ 'create.addPhotos' | t }}<br />
            <small>{{ 'create.photosHint' | t: { max } }}</small>
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden (change)="pick($event)" />
          </label>
        }
        @if (images().length) {
          <div class="image-previews">
            @for (img of images(); track img.key) {
              <div class="preview-item" [class.failed]="img.failed">
                <img [src]="img.preview" alt="" />
                @if (!img.uploaded && !img.failed) { <div class="uploading"><div class="spinner"></div></div> }
                @if (img.failed) { <div class="uploading">⚠️</div> }
                <button class="remove" (click)="removeImage(img.key)" [attr.aria-label]="'create.remove' | t">✕</button>
              </div>
            }
          </div>
        }
      </div>

      <div class="actions">
        <a routerLink="/feed" class="btn btn-secondary">{{ 'common.cancel' | t }}</a>
        <button class="btn btn-primary" (click)="publish()" [disabled]="!canPublish()">
          {{ (publishing() ? 'create.publishing' : uploading() ? 'create.uploading' : 'create.publish') | t }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .create-post { padding: 20px; }
    .create-post h1 { font-size: 1.3rem; margin-bottom: 20px; }
    .add-photos {
      display: block; border: 2px dashed var(--border); border-radius: 8px; padding: 24px; text-align: center;
      color: var(--muted); cursor: pointer; transition: border-color 0.15s; font-weight: 400 !important;
    }
    .add-photos:hover { border-color: var(--primary); color: var(--primary); }
    .image-previews { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
    .preview-item { position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #f1f5f9; }
    .preview-item img { width: 100%; height: 100%; object-fit: cover; }
    .preview-item.failed img { opacity: 0.4; }
    .uploading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.5); font-size: 24px; }
    .remove { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; font-size: 14px; cursor: pointer; }
    .actions { display: flex; gap: 12px; margin-top: 24px; }
    .actions .btn { flex: 1; }
  `,
})
export class CreatePostPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly max = MAX_IMAGES;
  protected text = '';
  protected readonly images = signal<Pending[]>([]);
  protected readonly publishing = signal(false);
  protected readonly uploading = computed(() => this.images().some((i) => !i.uploaded && !i.failed));
  private nextKey = 1;

  protected canPublish(): boolean {
    const hasContent = this.text.trim().length > 0 || this.images().some((i) => i.uploaded);
    return hasContent && !this.uploading() && !this.publishing();
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const room = MAX_IMAGES - this.images().length;
    if (files.length > room) this.toast.info(translate('create.tooMany', { max: MAX_IMAGES }));

    for (const file of files.slice(0, room)) {
      if (file.size > MAX_BYTES) {
        this.toast.error(translate('create.tooLarge', { name: file.name }));
        continue;
      }
      const item: Pending = { key: this.nextKey++, preview: URL.createObjectURL(file), uploaded: null, failed: false };
      this.images.update((l) => [...l, item]);
      this.api.uploadImage(file).subscribe({
        next: (dto) => this.patch(item.key, { uploaded: dto }),
        error: (e) => {
          this.patch(item.key, { failed: true });
          this.toast.error(errorMessage(e, 'error.uploadFailed'));
        },
      });
    }
  }

  protected removeImage(key: number): void {
    const img = this.images().find((i) => i.key === key);
    if (img) URL.revokeObjectURL(img.preview);
    this.images.update((l) => l.filter((i) => i.key !== key));
  }

  protected publish(): void {
    if (!this.canPublish()) return;
    this.publishing.set(true);
    const ids = this.images().flatMap((i) => (i.uploaded ? [i.uploaded.id] : []));
    this.api.createPost(this.text.trim(), ids).subscribe({
      next: () => {
        this.toast.success(translate('create.posted'));
        this.router.navigateByUrl('/feed');
      },
      error: (e) => {
        this.publishing.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  ngOnDestroy(): void {
    this.images().forEach((i) => URL.revokeObjectURL(i.preview));
  }

  private patch(key: number, change: Partial<Pending>): void {
    this.images.update((l) => l.map((i) => (i.key === key ? { ...i, ...change } : i)));
  }
}
