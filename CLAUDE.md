# Eisenwerk – Projektregeln

Browser-Fabrikspiel (Arbeitstitel „Eisenwerk“). Den Namen des Vorbilds nie im Spiel verwenden.

## Regeln
- Vite, TypeScript strict, PixiJS 8, Vitest, Playwright. Kein Backend, kein React; HUD als DOM-Overlay (`src/ui/`).
- `src/sim/` kennt weder DOM noch PixiJS, läuft headless, deterministisch, 60 Ticks/s, ganzzahlige Bandlogik.
- Alle Zahlenwerte in `src/data/`, jede Quelle in `docs/GAME_DATA.md` (Wiki > factorio-data-Prototypen > Messvorschlag).
  Aus factorio-data nur einzelne Zahlen ablesen, nichts kopieren, keine Abhängigkeit. Kein Reverse Engineering.
- Bänder: Transportlinien mit Abständen (`src/sim/belts.ts`), nie Items einzeln pro Tick bewegen.
- Grafik selbst erzeugt: bevorzugt Blender-Skripte (`assets/blender/`, headless `blender -b -P`); erlaubt sind auch
  prozedurale Grafik im Code und Bildgeneratoren, wenn das Ergebnis der Stilbibel (`docs/ART_STYLE.md`) folgt.
  Nie Grafiken/Icons/Sounds aus dem Vorbild, dessen Wiki oder fremden Quellen ohne passende Lizenz; Herkunft jeder
  Grafik, die nicht aus Blender kommt, in `docs/ASSET_PROVENANCE.md` (Skill `create-game-assets`).
  Ergebnis: PNG-Arbeitsatlanten in `assets/atlas/` (eingecheckt, nicht ausgeliefert) und daraus WebP für die Seite:
  `public/assets/hd/` (volle Auflösung) und `public/assets/sd/` (halbe, Standard), Liste in `public/assets/manifest.json`.
  Atlasframes werden auf sichtbare Pixel beschnitten. Grafikqualität: Menü bzw. `?hd`/`?sd`. Nach jedem Renderlauf
  Kontaktbogen ansehen.
- Natur-Grafik (Wiese, Kiesel, Gräser, Sträucher, Bäume) nutzt die eigenen Gartenwerk-Generatoren
  (`assets/blender/lib/gartenwerk/`, aus `allgrinder/Greenlabv2`). Szene/Licht für alle Modelle: `gw_lib.reset_scene` (AgX).
- Stil: natürlich, trockene Steppenwiese. Bäume sind wie im Original fällbar (Holz, `src/sim/trees.ts`) und
  blockieren das Bauen; Sträucher, Felsen, Schilf bleiben Dekoration.
- Ziel: so nah wie möglich am Original (Wiki ist Quelle 1, Abgleich in `docs/WIKI_ABGLEICH.md`).
- Meilenstein fertig erst, wenn `npm run build`, `npm test` und `npm run e2e` durchlaufen.
- Erweiterbarkeit: neue Gebäude/Ressourcen/Rezepte nur über `src/data/` + `kind`-Verhalten in `src/sim/`.
- Spieleentwicklungs-Skills (Fremdquelle, Apache-2.0) in `.claude/skills/` (siehe dortige README); diese Regeln haben Vorrang.

## Konventionen
- Richtungen 0=N,1=E,2=S,3=W; y wächst nach Süden. Gebäude-`dir` = Ausgaberichtung (Greifarm: Ablagerichtung).
- Bandspur 0 = links, 1 = rechts in Laufrichtung. Positionen 256 pro Feld.
- Spielstand: `src/sim/serialize.ts` (JSON), IndexedDB in `src/game/save.ts`. Formatänderung: `SAVE_VERSION` erhöhen und
  Umwandlung in `SAVE_MIGRATIONS` ergänzen (nie löschen); jedes Speichern behält die vorherige Fassung (` ~vorher`).
- Szenen über `?scene=freeplay|demo|sandbox|stress`; Gottmodus (Testhilfe) über `?god`.

## Stand und Überblick
- **Spielübersicht `docs/GDD.md`** (eine Quelle für Features, Status, Code-Links, Entscheidungen D-nnn). Nach jeder neuen
  oder geänderten Funktion dort Zeile/Status bzw. Entscheidung pflegen; `npm run check:docs` prüft Links und Status.
- Plan `docs/ROADMAP.md` · Werte mit Quellen `docs/GAME_DATA.md` · Abweichungen vom Original `docs/WIKI_ABGLEICH.md` ·
  Leistung `docs/PERFORMANCE.md` · Stil `docs/ART_STYLE.md` · Grafik-Herkunft `docs/ASSET_PROVENANCE.md`.
- Offene Messvorschläge in `docs/GAME_DATA.md` (Füllgrenzen Greifarm, Spurzuordnung Seiteneinspeisen).

## Technische Hinweise
- Gebäudeklassen in `src/sim/entities/` (Registry `registry.ts`), Ereignisse für Ton/Effekte `src/sim/events.ts`.
- Darstellung: Sprites mit 128 px pro Feld (Atlas-Auflösung 2), Spielwelt 64 Einheiten pro Feld; Wasser nach
  Ecken-Prinzip (`water.<Fall>.<Variante>`); Deko per Seed in `src/render/decor.ts` (Parameter `src/data/decor.ts`),
  Landschaftsräume `src/render/biome.ts`; Nachtlicht nutzt Normal-Maps (Blender schreibt `<name>.nrm`).
- Blender: bpy-Modul 5.2 in `.venv-blender` (OIDN, halbe Samples); `EISEN_PREVIEW=1` für Probeläufe; `npm run assets -- --deps`
  rendert nur geänderte Modelle. Baukasten `assets/blender/lib/kit.py`, Anlagen in `assets/blender/lib/` (`anlagen.py`,
  `spaet.py`, `bahn.py`, `kampf.py`, `kleinteile.py`, `kernkraft.py`, `stufen.py`); Blender-Add-ons Sapling und Rock
  Generator aus /usr/share/blender nur als Werkzeug.
- URL-Schalter: `?scene=…`, `?god`, `?bloom=0`, `?look=0`, `?pixel=0.5`, `?ui=1.3`, `?hd`/`?sd`. Messszene `?scene=factory`
  (`src/game/factoryscene.ts`), Bildzeiten in F3 (`src/game/perf.ts`). Editor-Modus F2 (`Game.editor`, `Game.free`).
- Klippen nur in neuen Karten (Einstellung `cliffs`). Wiki ist direkt erreichbar (Umgebung „Webgame“).

## Prüfen
- `npm run build && npm test && npm run e2e`, Doku: `npm run check:docs`
- Nach Grafikänderungen: `npm run assets && npm run assets:preview`, dann `assets/preview/*.png` ansehen.
