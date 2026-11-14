import { buildFactoryWorld } from '../src/game/factoryscene';
const t0 = performance.now();
const w = buildFactoryWorld();
console.log('build ms', (performance.now() - t0).toFixed(0), 'entities', w.entities.size, 'belts', w.belts.count, 'items', w.belts.itemCount);
const kinds = new Map<string, number>(); for (const e of w.entities.values()) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
console.log([...kinds].map(([k, n]) => `${k}:${n}`).join(' '));
w.run(300);
const ts: number[] = [];
for (let i = 0; i < 1200; i++) { const a = performance.now(); w.step(); ts.push(performance.now() - a); }
ts.sort((a, b) => a - b);
const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
console.log(`tick avg ${avg.toFixed(3)} p95 ${ts[Math.floor(ts.length * 0.95)].toFixed(3)} p99 ${ts[Math.floor(ts.length * 0.99)].toFixed(3)} max ${ts[ts.length - 1].toFixed(3)}`);
const st = new Map<number, number>(); for (const e of w.entities.values()) st.set(e.status, (st.get(e.status) ?? 0) + 1);
console.log('status', [...st].join(' | '));
const net = w.power.nets.map(n => `${n.poles.length}p ${n.consumers.length}c ${n.generators.length}g ${(n.supplied*60/1e6).toFixed(1)}MW/${(n.demand*60/1e6).toFixed(1)}`);
console.log('nets', w.power.nets.length, net.slice(0, 4).join(' ; '));
