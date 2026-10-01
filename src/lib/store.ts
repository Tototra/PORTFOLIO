// localStorage peut être indisponible (navigation privée, stockage bloqué) :
// le site doit fonctionner exactement pareil sans lui.

const PREFIX = 'tt:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* rien : simple confort */
  }
}
