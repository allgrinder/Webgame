import { entityDef } from '../data/entities';
import { Status } from './entity';
import { type PowerNet, electricOf, isGenerator } from './power';
import type { World } from './world';

/** Zusammenfassung eines Stromnetzes für die Übersicht (alle Leistungen in J je Tick). */
export interface NetReport {
  readonly key: number;
  readonly poles: number;
  readonly demand: number;
  readonly supplied: number;
  /** jetzt abrufbar (Dampf vorhanden, Sonne, Akkus). */
  readonly potential: number;
  /** Nennleistung aller Erzeuger (Dampfmaschinen voll, Solar bei Tag). */
  readonly installed: number;
  readonly generators: { name: string; count: number; installed: number }[];
  readonly consumers: { name: string; count: number }[];
  /** Dampfmaschinen in diesem Netz ohne Dampf. */
  readonly noSteam: number;
}

export interface PowerReport {
  readonly nets: NetReport[];
  /** Stromverbraucher außerhalb jedes Versorgungsbereichs. */
  readonly unconnected: number;
  /** Erzeuger ohne Mast in Reichweite. */
  readonly generatorsAlone: number;
  readonly boilers: number;
  readonly boilersNoFuel: number;
  readonly boilersNoWater: number;
  readonly engines: number;
}

/** Nennleistung eines Erzeugers in J/Tick. */
function ratedPower(name: string): number {
  const d = entityDef(name) as { maxPower?: number; production?: number };
  return (d.maxPower ?? d.production ?? 0) / 60;
}

function count(names: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  return m;
}

function netReport(w: World, net: PowerNet): NetReport {
  const gens = count(net.generatorNames);
  let noSteam = 0;
  for (const [id, n] of w.power.netOf) {
    if (n !== net) continue;
    const e = w.entities.get(id);
    if (e?.kind === 'generator' && e.status === Status.NoInput) noSteam++;
  }
  return {
    key: net.key,
    poles: net.poles.length,
    demand: net.demand,
    supplied: net.supplied,
    potential: net.potential,
    installed: [...gens].reduce((a, [n, c]) => a + ratedPower(n) * c, 0),
    generators: [...gens].map(([name, c]) => ({ name, count: c, installed: ratedPower(name) * c })).sort((a, b) => b.installed - a.installed),
    consumers: [...count(net.consumerNames)].map(([name, c]) => ({ name, count: c })).sort((a, b) => b.count - a.count),
    noSteam,
  };
}

/** Übersicht über alle Netze und typische Fehler (Brennstoff, Wasser, fehlender Mast). */
export function powerReport(w: World): PowerReport {
  w.power.ensure(w);
  let unconnected = 0;
  let generatorsAlone = 0;
  let boilers = 0;
  let boilersNoFuel = 0;
  let boilersNoWater = 0;
  let engines = 0;
  for (const e of w.entities.values()) {
    if (e.kind === 'boiler') {
      boilers++;
      if (e.status === Status.NoFuel) boilersNoFuel++;
      else if (e.status === Status.NoInput) boilersNoWater++;
      continue;
    }
    if (e.kind === 'generator') engines++;
    if (w.power.netOf.has(e.id)) continue;
    if (isGenerator(e)) generatorsAlone++;
    else if (e.kind !== 'pole' && electricOf(e)) unconnected++;
  }
  const nets = w.power.nets.map((n) => netReport(w, n)).sort((a, b) => b.installed - a.installed || b.consumers.length - a.consumers.length);
  return { nets, unconnected, generatorsAlone, boilers, boilersNoFuel, boilersNoWater, engines };
}
