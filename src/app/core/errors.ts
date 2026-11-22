import { HttpErrorResponse } from '@angular/common/http';
import { I18nKey, currentLocale, hasKey, translate } from './i18n/i18n';
import { ApiProblem } from './models';

/**
 * Human-readable, translated message for any HTTP error. Known backend error codes are translated;
 * otherwise English shows the server's message and Serbian shows the fallback.
 */
export function errorMessage(err: unknown, fallback: I18nKey = 'error.generic'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return translate('error.network');
    const problem = err.error as ApiProblem | null;
    const english = currentLocale().startsWith('en');
    if (problem?.errors && english) {
      const first = Object.values(problem.errors)[0];
      if (first) return first;
    }
    const codeKey = `error.${problem?.code}`;
    if (problem?.code && hasKey(codeKey)) return translate(codeKey);
    if (problem?.detail && english) return problem.detail;
  }
  return translate(fallback);
}

/** Field-level validation errors (field name -> message), if any. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (err instanceof HttpErrorResponse) {
    return ((err.error as ApiProblem | null)?.errors) ?? {};
  }
  return {};
}

export function errorCode(err: unknown): string | undefined {
  return err instanceof HttpErrorResponse ? (err.error as ApiProblem | null)?.code : undefined;
}
