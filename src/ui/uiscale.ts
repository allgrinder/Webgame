/**
 * Größe der Oberfläche (Skill game-ui-ux: Text auf dem PC mindestens 18 px bei 1080p, bis 200 % skalierbar).
 * Wirkt per CSS `zoom` auf die Bedienfelder (nicht auf Karte und Minimap, deren Mausumrechnung sonst nicht stimmt).
 */
export const UI_SCALES = [1, 1.15, 1.3, 1.5, 1.75, 2] as const;
const KEY = 'eisenwerk.uiscale';
let current = 1;

export function uiScale(): number {
  return current;
}

/** Gespeicherte Größe lesen (`?ui=1.3` geht vor) und anwenden. */
export function loadUiScale(): number {
  let v = 1;
  try {
    const q = new URLSearchParams(location.search).get('ui') ?? localStorage.getItem(KEY);
    const n = Number(q);
    if (q && Number.isFinite(n) && n >= 0.75 && n <= 2.5) v = n;
  } catch { /* ohne Speicher */ }
  applyUiScale(v);
  return v;
}

export function applyUiScale(v: number): void {
  current = v;
  document.documentElement.style.setProperty('--ui', String(v));
}

export function setUiScale(v: number): void {
  applyUiScale(v);
  try {
    localStorage.setItem(KEY, String(v));
  } catch { /* ohne Speicher */ }
}

/** Nächste Stufe (zyklisch). */
export function nextUiScale(v = current): number {
  const i = UI_SCALES.findIndex((s) => Math.abs(s - v) < 0.01);
  return UI_SCALES[(i + 1) % UI_SCALES.length];
}
