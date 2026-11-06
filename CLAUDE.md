# Eisenwerk – Projektregeln

Browser-Fabrikspiel (Arbeitstitel „Eisenwerk“). Den Namen des Vorbilds nie im Spiel verwenden.

## Regeln
- Vite, TypeScript strict, PixiJS 8, Vitest, Playwright. Kein Backend, kein React; HUD als DOM-Overlay (`src/ui/`).
- `src/sim/` kennt weder DOM noch PixiJS, läuft headless, deterministisch, 60 Ticks/s, ganzzahlige Bandlogik.
- Alle Zahlenwerte in `src/data/`, jede Quelle in `docs/GAME_DATA.md` (Wiki > factorio-data-Prototypen > Messvorschlag).
  Aus factorio-data nur einzelne Zahlen ablesen, nichts kopieren, keine Abhängigkeit. Kein Reverse Engineering.
- Bänder: Transportlinien mit Abständen (`src/sim/belts.ts`), nie Items einzeln pro Tick bewegen.
- Grafik nur aus Blender-Skripten (`assets/blender/`, headless `blender -b -P`), keine fremden Grafiken/Icons/Sounds.
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

## Konventionen
- Richtungen 0=N,1=E,2=S,3=W; y wächst nach Süden. Gebäude-`dir` = Ausgaberichtung (Greifarm: Ablagerichtung).
- Bandspur 0 = links, 1 = rechts in Laufrichtung. Positionen 256 pro Feld.
- Spielstand: `src/sim/serialize.ts` (JSON), IndexedDB in `src/game/save.ts`.
- Szenen über `?scene=freeplay|demo|sandbox|stress`; Gottmodus (Testhilfe) über `?god`.

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
- Phase B Komfort: fertig (Eisenkiste, Bodenitems, Rückgängig, gerade Linie, Autosave/Export/Import).
- Phase C fertig: Kupfer/Ziegel/Kabel/Schaltkreis; Flüssigkeiten (`src/sim/fluids.ts`, Netze wie Rohrsegmente) und
  Strom (`src/sim/power.ts`, Puffer je Verbraucher); Montagemaschine und Labor (`src/sim/entities/production.ts`),
  Forschung (`src/sim/research.ts`, Daten `src/data/tech.ts`, gesperrte Rezepte); Logistik: schnelles Band
  (Geschwindigkeit je Linie), Untergrundband (Teil der Transportlinie), Splitter (`src/sim/entities/logistics.ts`).
- Gebäudeklassen in `src/sim/entities/` (Registry `registry.ts`); Modelle der neuen Anlagen in `assets/blender/lib/anlagen.py`.
- Blender: bpy-Modul 5.2 in `.venv-blender` (mit OIDN-Denoiser, halbe Samples); `EISEN_PREVIEW=1` für schnelle Probeläufe.
- Phase A: Effekte (`src/render/effects.ts`, `src/data/fx.ts`), Figur 8 Richtungen (`models/player.py`), Nadelbäume/Felsgruppen
  (`models/landscape.py`, nutzt die Blender-Add-ons Sapling und Rock Generator aus /usr/share/blender als Werkzeug),
  Tooltips/Minimap (`src/ui/tooltip.ts`, `src/ui/minimap.ts`).
- Karte: Feuchte-Feld (`GameMap.moistureAt`), Seen (verzerrtes fbm), Flüsse mit Furten, Startsee; Landschaftsräume
  in der Darstellung (`src/render/biome.ts`: Bodenfarbe, Deko-Gewichtung `fertility`). Wolkenschatten `src/render/clouds.ts`.
- Freies Spiel: zufälliger Seed je neuer Runde, Startdialog „Weiterspielen“, Autosave alle 5 min und beim Verlassen der Seite.
- Asset-Pipeline rendert ein Modell nur neu, wenn sein Skript oder eine importierte Bibliothek sich ändert (`npm run assets -- --deps`).
- Phase E (Wiki-Abgleich): Korrekturen (Kessel 1:10, Greifarm-Takt/Energie, Füllgrenzen, Splitter-Vorrang/Filter,
  Auslöser-Forschung), fällbare Bäume/Holz, frühe Phase (Stahl, Masten, Lampe, Montage 2, Motor, Pumpe, Tank,
  Rohr unterirdisch, Landaufschüttung), Tag/Nacht (`DAY` in `src/data/time.ts`, Nachtebene `src/render/night.ts`).
  Tests: `tests/sim/wiki.test.ts`, `trees.test.ts`, `early.test.ts`. Gegner bewusst zurückgestellt.
- Blöcke 1–4 (Wunsch „1 bis 4 umsetzen“): Öl/Chemie (`entities/fluidplus.ts`, Modelle `models/oil.py`), Solar/Akku
  (Stromvorrang in `src/sim/power.ts`), Statistik (`src/sim/stats.ts`, `src/ui/stats.ts`), Forschungswarteschlange,
  Blaupausen/Geister (`src/sim/blueprint.ts`), Module/Leuchtfeuer (`src/sim/modules.ts`, `src/data/modules.ts`),
  Roboter (`src/sim/robots.ts`, `src/data/robots.ts`), Schaltungsnetz (`src/sim/circuit.ts`, Taste G),
  Züge (`src/sim/rails.ts`, `src/sim/trains.ts`, Gleise auf 2er-Raster, R wechselt Gleisform), Raketensilo
  (`entities/rocket.ts`). Vereinfachungen in `docs/WIKI_ABGLEICH.md` Abschnitt 4. Modelle: `lib/spaet.py`, `lib/bahn.py`.
- Gegner (Phase H): Verschmutzung `src/sim/pollution.ts`, Nester/Krabbler/Angriffe `src/sim/enemies.ts`, Türme/Mauern
  `src/sim/entities/military.ts`, Werte `src/data/enemies.ts`, Modelle `lib/kampf.py`/`models/gegner.py`; Karteneinstellungen
  (Rohstoffe, Gegner) in `src/data/mapgen.ts` und im Spielstand. Leertaste schießt, Reparaturset per Linksklick halten.
- Stil „Endzeit-Industrie“ in drei Ausbaustufen (Notbau → Werkstatt → Hochtechnik): `docs/ART_STYLE.md`, Baukasten
  `assets/blender/lib/kit.py`; Pilot Montagemaschinen 1–3 (`lib/stufen.py`, `models/montage.py`). Neue/überarbeitete
  Modelle folgen der Stilbibel.
- Phase I: Geräusche `src/audio/sound.ts` (ZzFX, Ereignisse `src/sim/events.ts`), Spielstände gzip (`src/game/packing.ts`),
  Bloom (pixi-filters, Menü/`?bloom=0`), Partikel-Ausbrüche (`render/effects.ts`), Flussfeld-Wegsuche (`src/sim/flowfield.ts`),
  Eigenschafts-Tests (fast-check). Wiki ist direkt erreichbar (Umgebung „Webgame“).
- Weiterer Plan: `docs/ROADMAP.md` (Grafik zuerst, dann Komfort, dann neue Systeme).
- Offene Messvorschläge siehe `docs/GAME_DATA.md` (Füllgrenzen Greifarm, Spurzuordnung Seiteneinspeisen).

## Prüfen
- `npm run build && npm test && npm run e2e`
- Nach Grafikänderungen: `npm run assets && npm run assets:preview`, dann `assets/preview/*.png` ansehen.
