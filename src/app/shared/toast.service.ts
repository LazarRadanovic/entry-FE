import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  info(text: string): void {
    this.show(text, 'info');
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(text: string, kind: Toast['kind']): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-2), { id, text, kind }]);
    setTimeout(() => this.dismiss(id), 4000);
  }
}
