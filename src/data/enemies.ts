/**
 * Gegner, Verschmutzung und Verteidigung. Quellen in docs/GAME_DATA.md (Abschnitt „Gegner“):
 * Wiki-Werte, wo sie vorliegen; sonst Messvorschlag (vereinfachtes Modell).
 * Aussehen und Namen sind eigene Entwürfe („Krabbler“, „Nest“).
 */
import type { EnemySetting } from './mapgen';

/** Verschmutzung je Minute im Betrieb (Wiki „Pollution“ bzw. Infobox des Gebäudes). */
export const POLLUTION_PER_MINUTE: Readonly<Record<string, number>> = {
  'burner-mining-drill': 12,
  'electric-mining-drill': 10,
  'stone-furnace': 2,
  'steel-furnace': 4,
  'electric-furnace': 1,
  boiler: 30,
  'assembling-machine-1': 4,
  'assembling-machine-2': 3,
  'assembling-machine-3': 2,
  pumpjack: 10,
  'oil-refinery': 6,
  'chemical-plant': 4,
};

/** Verbreitung je Kartenabschnitt (32×32). */
export const POLLUTION = {
  chunk: 32,
  /** alle n Ticks: Anteil, der in jeden der vier Nachbarn wandert (Original-Standard 2 % je 64 Ticks). */
  interval: 64,
  diffusion: 0.02,
  /** Aufnahme durch den Boden je Abschnitt und Minute (Gras ≈ 0,0000075/Tick je Feld × 1024 Felder). */
  groundAbsorbPerMinute: 27,
  /** unter dieser Menge wird ein Abschnitt nicht weiter verteilt (Rechenaufwand). */
  minSpread: 15,
} as const;

export type UnitKind = 'small' | 'medium' | 'big';

export interface UnitDef {
  readonly kind: UnitKind;
  readonly name: string;
  readonly health: number;
  readonly damage: number;
  /** Ticks zwischen zwei Bissen. */
  readonly cooldown: number;
  /** Felder je Tick. */
  readonly speed: number;
  /** Panzerung gegen physischen Schaden: fester Abzug und Prozent. */
  readonly armorFlat: number;
  readonly armorPercent: number;
  /** Verschmutzung, die ein Nest für diese Einheit aufnimmt (Angriff). */
  readonly pollution: number;
  readonly radius: number;
  /** Darstellung: Maßstab des Sprites. */
  readonly scale: number;
}

/** Wiki „Small/Medium/Big biter“ (Gesundheit, Schaden, Tempo, Verschmutzung für den Angriff). */
export const UNITS: Readonly<Record<UnitKind, UnitDef>> = {
  small: { kind: 'small', name: 'Kleiner Krabbler', health: 15, damage: 7, cooldown: 35, speed: 0.2, armorFlat: 0, armorPercent: 0, pollution: 4, radius: 0.25, scale: 0.6 },
  medium: { kind: 'medium', name: 'Mittlerer Krabbler', health: 75, damage: 15, cooldown: 35, speed: 0.24, armorFlat: 4, armorPercent: 0.1, pollution: 20, radius: 0.35, scale: 0.9 },
  big: { kind: 'big', name: 'Großer Krabbler', health: 375, damage: 30, cooldown: 35, speed: 0.23, armorFlat: 8, armorPercent: 0.1, pollution: 80, radius: 0.5, scale: 1.3 },
};

/** Nest (Vorbild: Spawner): Gesundheit nach Wiki, Größe 5×5; Rest Messvorschlag. */
export const NEST = {
  health: 350,
  size: 5,
  /** Verteidiger je Nest höchstens; Nachschub alle n Ticks. */
  maxDefenders: 5,
  spawnCooldown: 360,
  /** Aufnahme von Verschmutzung je Abschnitt und Minute (fest) plus Anteil des Bestands. */
  absorbPerMinute: 60,
  absorbFraction: 0.01,
  /** Angriff, sobald so viele Einheiten bereitstehen (oder nach waitTicks mit mindestens einer). */
  groupSize: 6,
  waitTicks: 60 * 60,
  /** Verteidiger greifen Spieler/Gebäude in diesem Umkreis an. */
  guardRadius: 14,
  /** Angriffsziele: verschmutzende Gebäude in diesem Umkreis um das Nest. */
  attackRadius: 260,
} as const;

/** Entwicklung (Wiki „Enemies“, Abschnitt Evolution; Standard-Karteneinstellungen). */
export const EVOLUTION = {
  timePerSecond: 0.000004,
  perNestDestroyed: 0.002,
  perPollution: 0.0000009,
  /** Ab dieser Entwicklung erscheinen mittlere bzw. große Krabbler (Messvorschlag nach Spawn-Tabelle). */
  mediumFrom: 0.2,
  bigFrom: 0.5,
} as const;

/** Nester auf der Karte je Einstellung: Rasterzelle, Wahrscheinlichkeit, Nester je Basis, Abstand zum Start. */
export const ENEMY_MAPGEN: Readonly<Record<EnemySetting, { cell: number; chance: number; nestsMin: number; nestsMax: number; startFree: number; evolutionFactor: number }>> = {
  aus: { cell: 96, chance: 0, nestsMin: 0, nestsMax: 0, startFree: 200, evolutionFactor: 0 },
  friedlich: { cell: 96, chance: 0.35, nestsMin: 2, nestsMax: 4, startFree: 140, evolutionFactor: 1 },
  normal: { cell: 96, chance: 0.35, nestsMin: 2, nestsMax: 5, startFree: 140, evolutionFactor: 1 },
  stark: { cell: 80, chance: 0.5, nestsMin: 3, nestsMax: 7, startFree: 110, evolutionFactor: 1.5 },
};

/** Munition (Wiki „Firearm magazine“, „Piercing rounds magazine“): Schaden je Schuss, Schuss je Magazin. */
export const AMMO: Readonly<Record<string, { damage: number; rounds: number }>> = {
  'firearm-magazine': { damage: 5, rounds: 10 },
  'piercing-rounds-magazine': { damage: 8, rounds: 10 },
};

/** Geschützturm (Wiki „Gun turret“): 2×2, Reichweite 18, 10 Schuss/s. */
export const TURRET = {
  range: 18,
  cooldown: 6,
  /** Drehung je Tick (Bogenmaß, Messvorschlag). */
  turnSpeed: 0.15,
} as const;

/** Waffen der Spielfigur (Wiki „Pistol“, „Submachine gun“). */
export const WEAPONS = {
  pistol: { range: 15, cooldown: 15 },
  'submachine-gun': { range: 18, cooldown: 6 },
} as const;

/** Spielfigur (Wiki „Character“): 250 Lebenspunkte, Heilung 0,15/Tick nach 10 s ohne Treffer. */
export const PLAYER_COMBAT = {
  health: 250,
  healPerTick: 0.15,
  healDelay: 600,
} as const;

/** Reparaturset (Wiki „Repair pack“): Haltbarkeit 300, Tempo 2 → 2 Lebenspunkte je Tick (Messvorschlag). */
export const REPAIR = { durability: 300, perTick: 2 } as const;
