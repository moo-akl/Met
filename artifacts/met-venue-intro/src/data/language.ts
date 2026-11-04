const params =
  typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);

export const isSpanish = params.get('lang') === 'es';

export function copy(english: string, spanish: string) {
  return isSpanish ? spanish : english;
}

export function withLanguage(path: string) {
  return isSpanish ? `${path}?lang=es` : path;
}
