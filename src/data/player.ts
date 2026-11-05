/** Spielfigur. Quelle: factorio-data character-Prototyp, siehe docs/GAME_DATA.md */
export const PLAYER = {
  /** Laufgeschwindigkeit in Feldern pro Tick. */
  runningSpeed: 0.15,
  miningSpeed: 0.5,
  /** Reichweite für Bauen und Gebäude öffnen (Felder). */
  buildDistance: 10,
  reachDistance: 10,
  /** Reichweite für Handabbau von Ressourcen (Felder). */
  resourceReachDistance: 2.7,
  inventorySlots: 80,
  quickbarSlots: 10,
  /** Kollisionsradius in Feldern. */
  radius: 0.2,
  craftingSpeed: 1,
  /** Reichweite für das Aufheben von Bodenitems (Felder). */
  groundPickupDistance: 1,
} as const;

/** Freeplay-Startausrüstung. */
export const START_INVENTORY: readonly { item: string; amount: number }[] = [
  { item: 'iron-plate', amount: 8 },
  { item: 'wood', amount: 1 },
  { item: 'burner-mining-drill', amount: 1 },
  { item: 'stone-furnace', amount: 1 },
];
