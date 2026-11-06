import { entityDef } from '../data/entities';
import { ITEMS, ITEM_IDS } from '../data/items';
import { MAPGEN } from '../data/mapgen';
import { AMMO, PLAYER_COMBAT, REPAIR, WEAPONS } from '../data/enemies';
import { GOD, PLAYER, START_INVENTORY } from '../data/player';
import { RECIPES, type RecipeDef, craftingRecipeFor } from '../data/recipes';
import { RESOURCE_BY_INDEX } from '../data/resources';
import { secondsToTicks } from '../data/time';
import { Inventory } from './inventory';
import type { World } from './world';

/** Spieler-Positionen in 1/256 Feldern (ganzzahlig, deterministisch). */
export const SUB = 256;

export interface CraftJob {
  recipe: string;
  /** Verbleibende Ticks. */
  ticks: number;
  /** Ergebnis ins Inventar (false = Zwischenprodukt für den nächsten Auftrag). */
  toInventory: boolean;
  /** Bereits entnommene Rohzutaten (Erstattung beim Abbrechen). */
  refund?: [string, number][];
}

export type MineTarget =
  | { kind: 'resource'; x: number; y: number; /** Rohstoff-Index: gleicher Rohstoff → Fortschritt bleibt. */ res?: number }
  | { kind: 'entity'; id: number }
  | { kind: 'tree'; cx: number; cy: number; i: number; x: number; y: number };

export class Player {
  /** Mittelpunkt in 1/256 Feldern. */
  px: number;
  py: number;
  prevPx: number;
  prevPy: number;
  /** Bewegungseingabe -1..1 je Achse. */
  moveX = 0;
  moveY = 0;
  facing = 2;
  walking = false;
  readonly inventory = new Inventory(PLAYER.inventorySlots);
  /** Schnellleiste: Item-IDs (Verweise, wie im Vorbild). */
  readonly quickbar: (string | null)[] = new Array(PLAYER.quickbarSlots).fill(null);
  readonly craftQueue: CraftJob[] = [];
  /** Lebenspunkte, letzter Treffer (Heilung), Tod (Wiedereinstieg am Start). */
  hp: number = PLAYER_COMBAT.health;
  lastHit = -1e9;
  dead = false;
  /** Schießen (Leertaste halten): Ziel automatisch im Umkreis der Waffe. */
  shooting = false;
  private gunCd = 0;
  /** Schuss im angebrochenen Magazin. */
  rounds = 0;
  roundsItem: string | null = null;
  /** Darstellung: letzter Schuss. */
  lastShot = -100;
  shotX = 0;
  shotY = 0;
  /** Reparatur (Reparaturset in der Hand, Linksklick halten). */
  repairTarget: number | null = null;
  repairUsed = 0;
  mineTarget: MineTarget | null = null;
  mineProgress = 0;
  /** Ticks, die das aktuelle Ziel benötigt (für den Fortschrittsbalken). */
  mineTotal = 0;
  /** Meldungen für das HUD (werden vom Spiel geleert). */
  readonly messages: string[] = [];
  /** Taste zum Aufheben von Bodenitems gehalten (Eingabe wie moveX). */
  pickingUp = false;
  /** Von der Welt gesetzt: Rezept freigeschaltet (Forschung). */
  recipeUnlocked: (recipe: string) => boolean = () => true;
  /** Von der Welt gesetzt: Herstellung melden (Auslöser-Forschung). */
  onCrafted: (item: string, n: number) => void = () => {};
  /** Von der Welt gesetzt: Verbrauch melden (Statistik). */
  onUsed: (item: string, n: number) => void = () => {};
  /** Gottmodus (Testhilfe, `?god`): schneller Abbau, Handwerk, Laufen, Reichweite. */
  god = false;
  private godAcc = 0;
  /** Vom Spieler abgebaute Gebäude (für Rückgängig; vom Spiel geleert). */
  readonly minedLog: { name: string; x: number; y: number; dir: number }[] = [];

  constructor(x: number, y: number) {
    this.px = this.prevPx = Math.round(x * SUB);
    this.py = this.prevPy = Math.round(y * SUB);
  }

  get x(): number {
    return this.px / SUB;
  }
  get y(): number {
    return this.py / SUB;
  }

  giveStart(): void {
    for (const s of START_INVENTORY) this.inventory.add(s.item, s.amount);
    this.quickbar[0] = 'transport-belt';
    this.quickbar[1] = 'burner-inserter';
    this.quickbar[2] = 'burner-mining-drill';
    this.quickbar[3] = 'stone-furnace';
    this.quickbar[4] = 'iron-chest';
    this.quickbar[5] = 'coal';
    this.quickbar[6] = 'iron-plate';
  }

  overlapsRect(x: number, y: number, w: number, h: number): boolean {
    const r = PLAYER.radius;
    return this.x + r > x && this.x - r < x + w && this.y + r > y && this.y - r < y + h;
  }

  distanceTo(x: number, y: number): number {
    return Math.hypot(this.x - x, this.y - y);
  }

  // ------------------------------------------------------------- Tick

  update(world: World): void {
    this.prevPx = this.px;
    this.prevPy = this.py;
    this.updateCombat(world);
    this.updateMovement(world);
    this.updateMining(world);
    this.updateCrafting(world);
    if (this.pickingUp && world.tick % PLAYER.pickupInterval === 0) {
      if (!this.pickUpGround(world)) this.pickUpBelt(world);
    }
  }

  // ------------------------------------------------------------- Kampf

  /** Schaden an der Spielfigur; bei 0 Lebenspunkten Neustart am Startpunkt (Inventar bleibt, Vereinfachung). */
  damage(world: World, dmg: number): void {
    if (this.dead || this.god) return;
    this.hp -= dmg;
    this.lastHit = world.tick;
    if (this.hp > 0) return;
    this.hp = PLAYER_COMBAT.health;
    this.px = 128;
    this.py = 128;
    this.prevPx = this.px;
    this.prevPy = this.py;
    this.mineTarget = null;
    this.note('Du bist gestorben – Neustart am Startpunkt');
  }

  private updateRepair(world: World): void {
    const id = this.repairTarget;
    if (id === null) return;
    const e = world.entities.get(id);
    if (!e || e.hp >= e.def.health || !this.canReach(e.cx, e.cy) || this.inventory.count('repair-pack') === 0) {
      this.repairTarget = null;
      return;
    }
    const heal = Math.min(REPAIR.perTick, e.def.health - e.hp);
    e.hp += heal;
    this.repairUsed += heal;
    if (this.repairUsed >= REPAIR.durability) {
      this.repairUsed -= REPAIR.durability;
      this.inventory.remove('repair-pack', 1);
      world.stats.used('repair-pack', 1);
    }
  }

  /** Waffe: Maschinenpistole, wenn vorhanden, sonst Pistole (Wiki „Pistol“, „Submachine gun“). */
  get weapon(): 'submachine-gun' | 'pistol' | null {
    if (this.inventory.count('submachine-gun') > 0) return 'submachine-gun';
    if (this.inventory.count('pistol') > 0) return 'pistol';
    return null;
  }

  private updateCombat(world: World): void {
    if (world.tick - this.lastHit > PLAYER_COMBAT.healDelay && this.hp < PLAYER_COMBAT.health) {
      this.hp = Math.min(PLAYER_COMBAT.health, this.hp + PLAYER_COMBAT.healPerTick);
    }
    this.updateRepair(world);
    if (this.gunCd > 0) this.gunCd--;
    if (!this.shooting || this.gunCd > 0) return;
    const wpn = this.weapon;
    if (!wpn) return;
    const W = WEAPONS[wpn];
    const t = world.enemies.nearestTarget(this.x, this.y, W.range, world.tick);
    if (!t) return;
    if (this.rounds === 0) {
      const it = Object.keys(AMMO).reverse().find((a) => this.inventory.count(a) > 0);
      if (!it) {
        if (world.tick % 60 === 0) this.note('Keine Munition');
        return;
      }
      this.inventory.remove(it, 1);
      world.stats.used(it, 1);
      this.rounds = AMMO[it].rounds;
      this.roundsItem = it;
    }
    this.rounds--;
    this.gunCd = W.cooldown;
    this.lastShot = world.tick;
    this.shotX = t.x;
    this.shotY = t.y;
    world.events.push('shot', this.x, this.y);
    world.enemies.damageTarget(world, t, AMMO[this.roundsItem!].damage, { x: this.x, y: this.y });
    if (this.rounds === 0) this.roundsItem = null;
  }

  /** Nächstes Bodenitem im Umkreis aufheben. */
  pickUpGround(world: World): boolean {
    const near = world.groundNear(this.x, this.y, PLAYER.groundPickupDistance);
    near.sort((a, b) => Math.hypot(a.g.x / SUB - this.x, a.g.y / SUB - this.y) - Math.hypot(b.g.x / SUB - this.x, b.g.y / SUB - this.y));
    for (const { key, g } of near) {
      if (this.inventory.add(g.item, 1) === 1) {
        world.removeGround(key, g);
        return true;
      }
    }
    return false;
  }

  /** Nächstes Item von einem Band in Reichweite aufnehmen (F halten, wie im Original). */
  pickUpBelt(world: World): boolean {
    const r = PLAYER.beltPickupDistance;
    const tiles: { tx: number; ty: number; d: number }[] = [];
    for (let ty = Math.floor(this.y - r); ty <= Math.floor(this.y + r); ty++) {
      for (let tx = Math.floor(this.x - r); tx <= Math.floor(this.x + r); tx++) {
        const d = Math.hypot(tx + 0.5 - this.x, ty + 0.5 - this.y);
        if (d <= r) tiles.push({ tx, ty, d });
      }
    }
    tiles.sort((a, b) => a.d - b.d);
    for (const { tx, ty } of tiles) {
      const t = world.belts.tileAt(tx, ty);
      if (!t) continue;
      const idx = world.belts.takeFromTile(t, (i) => this.inventory.space(ITEM_IDS[i]) > 0);
      if (idx >= 0) {
        this.inventory.add(ITEM_IDS[idx], 1);
        return true;
      }
    }
    return false;
  }

  /** Ein Item aus dem Inventar an einer Stelle auf den Boden (oder in ein Gebäude/Band) legen. */
  dropItem(world: World, item: string, px: number, py: number): boolean {
    if (this.inventory.count(item) < 1 || !this.canReach(px, py)) return false;
    if (!world.deliverAt(px, py, item, 'player', true)) return false;
    this.inventory.remove(item, 1);
    return true;
  }

  private updateMovement(world: World): void {
    let mx = Math.sign(this.moveX);
    let my = Math.sign(this.moveY);
    this.walking = mx !== 0 || my !== 0;
    if (!this.walking) return;
    if (mx !== 0 || my !== 0) this.facing = my < 0 ? 0 : my > 0 ? 2 : mx > 0 ? 1 : 3;
    const speed = Math.round(PLAYER.runningSpeed * SUB * (this.god ? GOD.runningFactor : 1));
    // Diagonal: 181/256 ≈ 1/√2
    const diag = mx !== 0 && my !== 0;
    const step = diag ? Math.round((speed * 181) / 256) : speed;
    const nx = this.px + mx * step;
    if (!this.collides(world, nx, this.py)) this.px = nx;
    else mx = 0;
    const ny = this.py + my * step;
    if (!this.collides(world, this.px, ny)) this.py = ny;
    else my = 0;
    // Bewegung bricht Abbau ab
    if (mx !== 0 || my !== 0) {
      if (this.mineTarget) this.mineProgress = 0;
    }
  }

  private collides(world: World, px: number, py: number): boolean {
    const r = PLAYER.radius;
    const x = px / SUB;
    const y = py / SUB;
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        if (world.map.isWater(tx, ty) || world.enemies.nestAt(tx, ty)) return true;
        const e = world.entityAt(tx, ty);
        if (e && entityDef(e.name).solid) {
          // Spieler, die bereits darin stehen (z. B. nach dem Bauen), dürfen hinaus
          const cur = world.entityAt(Math.floor(this.x), Math.floor(this.y));
          if (cur === e) continue;
          return true;
        }
      }
    }
    return false;
  }

  // ------------------------------------------------------------- Abbauen

  setMineTarget(t: MineTarget | null): void {
    const same =
      t && this.mineTarget && t.kind === this.mineTarget.kind &&
      (t.kind === 'resource'
        ? this.mineTarget.kind === 'resource' && t.x === this.mineTarget.x && t.y === this.mineTarget.y
        : t.kind === 'tree'
          ? this.mineTarget.kind === 'tree' && t.cx === this.mineTarget.cx && t.cy === this.mineTarget.cy && t.i === this.mineTarget.i
          : this.mineTarget.kind === 'entity' && t.id === this.mineTarget.id);
    if (same) return;
    // Zeiger rutscht auf ein Nachbarfeld desselben Rohstoffs: Fortschritt behalten (kein Neustart des Balkens)
    if (t?.kind === 'resource' && this.mineTarget?.kind === 'resource' && t.res !== undefined && t.res === this.mineTarget.res) {
      this.mineTarget = t;
      return;
    }
    this.mineTarget = t;
    this.mineProgress = 0;
    this.mineTotal = 0;
  }

  canReachResource(x: number, y: number): boolean {
    // Abstand zum nächsten Punkt des Feldes
    const cx = Math.max(x, Math.min(this.x, x + 1));
    const cy = Math.max(y, Math.min(this.y, y + 1));
    return Math.hypot(this.x - cx, this.y - cy) <= PLAYER.resourceReachDistance * (this.god ? GOD.reachFactor : 1);
  }

  canReach(x: number, y: number): boolean {
    return this.distanceTo(x, y) <= this.reach;
  }

  /** Reichweite zum Bauen und Öffnen (Felder). */
  get reach(): number {
    return PLAYER.reachDistance * (this.god ? GOD.reachFactor : 1);
  }
  get buildDistance(): number {
    return PLAYER.buildDistance * (this.god ? GOD.reachFactor : 1);
  }
  /** Abbautempo: im Gottmodus fast sofort (Bäume, Gebäude). */
  private mineTicks(seconds: number): number {
    return this.god ? 1 : Math.max(1, secondsToTicks(seconds / PLAYER.miningSpeed));
  }

  private updateMining(world: World): void {
    const t = this.mineTarget;
    if (!t) return;
    if (t.kind === 'tree') {
      const tree = world.map.trees.treeAt(Math.floor(t.x), Math.floor(t.y));
      if (!tree || tree.i !== t.i || !this.canReach(t.x, t.y)) {
        this.mineProgress = 0;
        if (!tree || tree.i !== t.i) this.mineTarget = null;
        return;
      }
      const kind = MAPGEN.trees.kinds[tree.kind];
      if (this.inventory.space('wood') < kind.wood) {
        this.note('Inventar voll');
        return;
      }
      this.mineTotal = this.mineTicks(kind.mineTime);
      if (++this.mineProgress >= this.mineTotal) {
        this.mineProgress = 0;
        world.events.push('tree', tree.x, tree.y);
        if (world.map.trees.remove(tree.cx, tree.cy, tree.i)) {
          this.inventory.add('wood', kind.wood);
          world.stats.made('wood', kind.wood);
        }
        this.mineTarget = null;
      }
      return;
    }
    if (t.kind === 'resource') {
      const r = world.map.resourceAt(t.x, t.y);
      if (r.amount === 0 || !this.canReachResource(t.x, t.y)) {
        this.mineProgress = 0;
        return;
      }
      const def = RESOURCE_BY_INDEX[r.res]!;
      if (this.inventory.space(def.result) < 1) {
        this.note('Inventar voll');
        return;
      }
      if (this.god) {
        // Gottmodus: GOD.minePerSecond Stück je Sekunde vom selben Feld
        this.mineTotal = 1;
        this.godAcc += GOD.minePerSecond;
        while (this.godAcc >= 60) {
          this.godAcc -= 60;
          if (this.inventory.space(def.result) < 1 || !world.map.mineOne(t.x, t.y)) break;
          this.inventory.add(def.result, 1);
          world.stats.made(def.result, 1);
        }
        return;
      }
      this.mineTotal = secondsToTicks(def.miningTime / (PLAYER.miningSpeed * PLAYER.handMiningFactor));
      if (++this.mineProgress >= this.mineTotal) {
        this.mineProgress = 0;
        world.events.push('mine', t.x + 0.5, t.y + 0.5);
        if (world.map.mineOne(t.x, t.y)) {
          this.inventory.add(def.result, 1);
          world.stats.made(def.result, 1);
        }
      }
    } else {
      const e = world.entities.get(t.id);
      if (!e) {
        this.mineTarget = null;
        return;
      }
      const def = entityDef(e.name);
      if (!this.canReach(e.cx, e.cy)) {
        this.mineProgress = 0;
        return;
      }
      this.mineTotal = this.mineTicks(def.mineTime);
      if (++this.mineProgress >= this.mineTotal) {
        this.mineProgress = 0;
        const rec = { name: e.name, x: e.x, y: e.y, dir: e.dir };
        world.events.push('remove', e.cx, e.cy);
        if (this.pickUpEntity(world, t.id)) this.minedLog.push(rec);
        this.mineTarget = null;
      }
    }
  }

  /** Gebäude aufnehmen (inkl. Inhalt). Was nicht passt, geht verloren wird vermieden: Abbruch. */
  pickUpEntity(world: World, id: number): boolean {
    const e = world.entities.get(id);
    if (!e) return false;
    const def = entityDef(e.name);
    if (this.inventory.space(def.item) < 1) {
      this.note('Inventar voll');
      return false;
    }
    const items = world.remove(id);
    for (const s of items) {
      const added = this.inventory.add(s.item, s.count);
      if (added < s.count) this.note(`${s.count - added}× ${ITEMS[s.item]?.name ?? s.item} verloren (Inventar voll)`);
    }
    return true;
  }

  // ------------------------------------------------------------- Handwerk

  /** Wieviele Exemplare per Hand herstellbar sind (inkl. Zwischenprodukten). */
  craftableCount(recipeId: string): number {
    const r = RECIPES[recipeId];
    if (!r || r.category !== 'crafting' || !this.recipeUnlocked(r.id)) return 0;
    let n = 0;
    const stock = this.stock();
    while (n < 500 && this.plan(r, stock)) n++;
    return n;
  }

  private stock(): Map<string, number> {
    const m = new Map<string, number>();
    for (const s of this.inventory.contents()) m.set(s.item, s.count);
    return m;
  }

  /**
   * Plant eine Herstellung gegen den (veränderten) Vorrat. Fehlende Zutaten werden über
   * Zwischenrezepte ergänzt. Liefert die Aufträge (Zwischenprodukte zuerst) oder null.
   */
  private plan(r: RecipeDef, stock: Map<string, number>, depth = 0): string[] | null {
    if (depth > 8) return null;
    const jobs: string[] = [];
    const backup = new Map(stock);
    for (const ing of r.ingredients) {
      let have = stock.get(ing.item) ?? 0;
      while (have < ing.amount) {
        const found = craftingRecipeFor(ing.item);
        const sub = found && this.recipeUnlocked(found.id) ? found : undefined;
        const p = sub ? this.plan(sub, stock, depth + 1) : null;
        if (!sub || !p) {
          restore(stock, backup);
          return null;
        }
        jobs.push(...p);
        have = (stock.get(ing.item) ?? 0) + sub.results.find((x) => x.item === ing.item)!.amount;
        stock.set(ing.item, have);
      }
      stock.set(ing.item, have - ing.amount);
    }
    jobs.push(r.id);
    return jobs;
  }

  /** Herstellung einreihen. Zutaten werden sofort aus dem Inventar entnommen. */
  craft(recipeId: string, count = 1): number {
    const r = RECIPES[recipeId];
    if (!r || r.category !== 'crafting' || !this.recipeUnlocked(r.id)) return 0;
    let done = 0;
    for (let i = 0; i < count; i++) {
      const before = this.stock();
      const after = new Map(before);
      const jobs = this.plan(r, after);
      if (!jobs) break;
      // Rohverbrauch = Vorrat vorher - nachher (Zwischenprodukte gleichen sich aus)
      const raw: [string, number][] = [];
      for (const [item, n] of before) {
        const d = n - (after.get(item) ?? 0);
        if (d > 0) raw.push([item, d]);
      }
      for (const [item, amt] of raw) this.inventory.remove(item, amt);
      jobs.forEach((j, k) => {
        const last = k === jobs.length - 1;
        this.craftQueue.push({
          recipe: j,
          ticks: Math.max(1, secondsToTicks(RECIPES[j].time / (PLAYER.craftingSpeed * (this.god ? GOD.craftingSpeed : 1)))),
          toInventory: last,
          refund: last ? raw : undefined,
        });
      });
      done++;
    }
    return done;
  }

  private updateCrafting(world: World): void {
    const job = this.craftQueue[0];
    if (!job) return;
    if (--job.ticks > 0) return;
    this.craftQueue.shift();
    world.events.push('craft', this.x, this.y);
    for (const ing of RECIPES[job.recipe].ingredients) this.onUsed(ing.item, ing.amount);
    for (const res of RECIPES[job.recipe].results) this.onCrafted(res.item, res.amount);
    if (!job.toInventory) return; // Zwischenprodukt wird vom folgenden Auftrag verbraucht
    for (const res of RECIPES[job.recipe].results) {
      const added = this.inventory.add(res.item, res.amount);
      if (added < res.amount) {
        // Inventar voll: Rest fällt neben die Figur (geht nicht verloren)
        for (let k = added; k < res.amount; k++) world.spill(this.x, this.y, res.item);
        this.note('Inventar voll – Ergebnis liegt auf dem Boden');
      }
    }
  }

  /** Warteschlange abbrechen und Zutaten erstatten. */
  cancelCrafting(): void {
    for (const j of this.craftQueue) if (j.refund) for (const [item, amt] of j.refund) this.inventory.add(item, amt);
    this.craftQueue.length = 0;
  }

  note(msg: string): void {
    if (this.messages[this.messages.length - 1] !== msg) this.messages.push(msg);
    if (this.messages.length > 5) this.messages.shift();
  }
}

function restore(stock: Map<string, number>, backup: Map<string, number>): void {
  stock.clear();
  for (const [k, v] of backup) stock.set(k, v);
}
