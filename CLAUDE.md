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
- Natur-Grafik (Wiese, Kiesel, Gräser, Sträucher, Bäume) nutzt die eigenen Gartenwerk-Generatoren
  (`assets/blender/lib/gartenwerk/`, aus `allgrinder/Greenlabv2`). Szene/Licht für alle Modelle: `gw_lib.reset_scene` (AgX).
- Stil: natürlich, trockene Steppenwiese; Bäume nur Dekoration (keine Kollision, kein Holz).
- Meilenstein fertig erst, wenn `npm run build`, `npm test` und `npm run e2e` durchlaufen.
- Erweiterbarkeit: neue Gebäude/Ressourcen/Rezepte nur über `src/data/` + `kind`-Verhalten in `src/sim/`.

## Konventionen
- Richtungen 0=N,1=E,2=S,3=W; y wächst nach Süden. Gebäude-`dir` = Ausgaberichtung (Greifarm: Ablagerichtung).
- Bandspur 0 = links, 1 = rechts in Laufrichtung. Positionen 256 pro Feld.
- Spielstand: `src/sim/serialize.ts` (JSON), IndexedDB in `src/game/save.ts`.
- Szenen über `?scene=freeplay|demo|sandbox|stress`.

## Stand
- M1 Bänder: fertig.
- M2 Blender-Pipeline: fertig (9 Modelle, 154 Sprites; Boden als periodische 8×8-Fläche).
- M3 Produktionskette: fertig (`?scene=demo`, Tests für Bohrer/Ofen/Greifarm/Kette/Speichern).
- M4 Spielbare Runde: fertig (Freeplay-Start, Handabbau, Inventar, Handwerk mit Zwischenprodukten,
  Gebäudefenster, Speichern/Laden in IndexedDB, Playwright-Ablauftest).
- Natürlicher Boden: Steppenwiese (periodisch 16×16), Decals (Erd-/Kiesflecken, Kiesel, Blüten, Grasbüschel),
  Flora (Sträucher, Findlinge, Bäume mit Schattenebene) per Seed in `src/render/decor.ts`, Parameter in `src/data/decor.ts`.
- Wasser (Seen/Teiche) in `src/sim/map.ts`, Darstellung nach Ecken-Prinzip (`water.<Fall>.<Variante>`).
- Sprites mit 128 px pro Feld (Atlas-Auflösung 2), Spielwelt weiter 64 Einheiten pro Feld.
- Weiterer Plan: `docs/ROADMAP.md` (Grafik zuerst, dann Komfort, dann neue Systeme).
- Offene Messvorschläge siehe `docs/GAME_DATA.md` (Füllgrenzen Greifarm, Spurzuordnung Seiteneinspeisen).

## Prüfen
- `npm run build && npm test && npm run e2e`
- Nach Grafikänderungen: `npm run assets && npm run assets:preview`, dann `assets/preview/*.png` ansehen.
