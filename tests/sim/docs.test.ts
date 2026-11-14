import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Doku bleibt beim Code (Skill game-docs): Jeder in CLAUDE.md und docs/*.md in `Backticks` genannte Pfad unter
 * src/, tests/, e2e/, docs/, assets/, scripts/ oder .claude/ muss existieren. Die Links der Spielübersicht prüft
 * zusätzlich `npm run check:docs`.
 */
const ROOTS = ['src/', 'tests/', 'e2e/', 'docs/', 'assets/', 'scripts/', '.claude/'];

function pathsIn(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const p = m[1].replace(/[),.:;]+$/, '');
    if (!ROOTS.some((r) => p.startsWith(r))) continue;
    if (/[<>*{}]/.test(p)) continue; // Muster wie water.<Fall> oder src/**/x
    out.push(p);
  }
  return out;
}

describe('Doku-Pfade', () => {
  const files = ['CLAUDE.md', ...readdirSync('docs').filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)];
  for (const f of files) {
    it(`${f}: genannte Pfade existieren`, () => {
      const missing = pathsIn(f).filter((p) => !existsSync(p));
      expect(missing).toEqual([]);
    });
  }
});
