import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Lightbox } from './shared/lightbox';
import { OfflineOverlay } from './shared/offline-overlay';
import { ToastHost } from './shared/toast-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, Lightbox, OfflineOverlay],
  template: `
    <router-outlet />
    <app-toast-host />
    <app-lightbox />
    <app-offline-overlay />
  `,
})
export class App {}
