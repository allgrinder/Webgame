# Eisenwerk – Projektregeln

Browser-Fabrikspiel (Arbeitstitel „Eisenwerk“). Den Namen des Vorbilds nie im Spiel verwenden.

## Regeln
- Vite, TypeScript strict, PixiJS 8, Vitest, Playwright. Kein Backend, kein React; HUD als DOM-Overlay (`src/ui/`).
- `src/sim/` kennt weder DOM noch PixiJS, läuft headless, deterministisch, 60 Ticks/s, ganzzahlige Bandlogik.
- Alle Zahlenwerte in `src/data/`, jede Quelle in `docs/GAME_DATA.md` (Wiki > factorio-data-Prototypen > Messvorschlag).
  Aus factorio-data nur einzelne Zahlen ablesen, nichts kopieren, keine Abhängigkeit. Kein Reverse Engineering.
- Bänder: Transportlinien mit Abständen (`src/sim/belts.ts`), nie Items einzeln pro Tick bewegen.
- Grafik nur aus Blender-Skripten (`assets/blender/`, headless `blender -b -P`), keine fremden Grafiken/Icons/Sounds.
  Ergebnis: Atlanten + `public/assets/manifest.json` (eingecheckt). Nach jedem Renderlauf Kontaktbogen ansehen.
- Meilenstein fertig erst, wenn `npm run build`, `npm test` und `npm run e2e` durchlaufen.
- Erweiterbarkeit: neue Gebäude/Ressourcen/Rezepte nur über `src/data/` + `kind`-Verhalten in `src/sim/`.

## Konventionen
- Richtungen 0=N,1=E,2=S,3=W; y wächst nach Süden. Gebäude-`dir` = Ausgaberichtung (Greifarm: Ablagerichtung).
- Bandspur 0 = links, 1 = rechts in Laufrichtung. Positionen 256 pro Feld.
- Spielstand: `src/sim/serialize.ts` (JSON), IndexedDB in `src/game/save.ts`.
- Szenen über `?scene=freeplay|demo|sandbox|stress`.

## Stand
- M1 Bänder: fertig (Gerüst, Karte, Kamera, Bänder, Kurven, Seiteneinspeisung, Debug-Items, Lastszene, Platzhaltergrafik).
- M2 Blender-Pipeline: offen.
- M3 Produktionskette: Simulation vorhanden, Demo-Szene offen.
- M4 Spielbare Runde: Grundgerüst (Spieler, Inventar, Handwerk, Speichern) vorhanden, offen.
