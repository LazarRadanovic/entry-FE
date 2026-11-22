import { registerLocaleData } from '@angular/common';
import localeSrLatn from '@angular/common/locales/sr-Latn';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

// Serbian (Latin) month/day names for DatePipe when the language is switched to SR.
registerLocaleData(localeSrLatn, 'sr-Latn');

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
