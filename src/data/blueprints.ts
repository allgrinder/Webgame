/**
 * Mitgelieferte Blaupausen-Vorlagen (eigene Anordnungen, Verhältnisse nach Wiki „Power production“:
 * 1 Kessel (1,8 MW) versorgt 2 Dampfmaschinen (je 900 kW)).
 */
import type { Blueprint } from '../sim/blueprint';

export interface BlueprintPreset {
  readonly name: string;
  readonly hint: string;
  readonly bp: Blueprint;
}

/**
 * Dampfkraft, Wasser im Norden (R dreht): Uferpumpe → Rohr → Kessel (Feuerung oben, Dampf nach unten)
 * → 2 Dampfmaschinen hintereinander → Strommast an der Seite. Kessel braucht Brennstoff (Kohle oder Holz).
 */
export const STEAM_POWER: Blueprint = {
  w: 5,
  h: 14,
  entities: [
    { name: 'offshore-pump', dx: 0, dy: 0, dir: 2 },
    { name: 'pipe', dx: 0, dy: 2, dir: 0 },
    { name: 'boiler', dx: 1, dy: 2, dir: 2 },
    { name: 'steam-engine', dx: 1, dy: 4, dir: 0 },
    { name: 'steam-engine', dx: 1, dy: 9, dir: 0 },
    { name: 'small-electric-pole', dx: 4, dy: 8, dir: 0 },
  ],
};

export const PRESETS: readonly BlueprintPreset[] = [
  {
    name: 'Dampfkraft 1:2 (1,8 MW)',
    hint: 'Uferpumpe ans Ufer (oberstes Feld auf Wasser, R dreht), dann Kohle oder Holz in den Kessel legen.',
    bp: STEAM_POWER,
  },
];
