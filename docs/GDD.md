# Eisenwerk — Spielübersicht (GDD)

**Version:** 1.1 · **Stand:** 2026-11-14 · [Features](#feature-index) · [Entscheidungen](#decisions) · [Änderungen](#change-log)

## Summary
Die Spielfigur landet auf einer trockenen Steppenwelt und baut aus Handabbau, ersten Bohrern und Öfen eine wachsende
Fabrik: Bänder, Greifarme und Montagemaschinen automatisieren Schritt für Schritt Platten, Zwischenprodukte und
Wissenschaftspakete; die Forschung schaltet Öl, Strom, Züge, Roboter und Kernkraft frei. Spaß machen das Planen und
Optimieren von Produktionsketten und das Gefühl einer laufenden Maschine. Ziel ist der Start einer Rakete mit
Satellit; danach geht das freie Spiel weiter.

| | |
|---|---|
| Genre und Kamera | Fabrikbau/Automatisierung, Draufsicht, 2D mit gerenderten 3D-Modellen |
| Vorbild | So nah wie möglich am Original-Fabrikspiel (Wiki ist Quelle 1, [Abgleich](WIKI_ABGLEICH.md)); Name des Vorbilds nie im Spiel |
| Plattform und Eingabe | Browser (Desktop), Maus und Tastatur; [spielbar online](https://allgrinder.github.io/Webgame/) |
| Sitzung | Freies Spiel ohne Ende, Autosave alle 5 min; bis zur Rakete viele Stunden |
| Technik | Vite, TypeScript, PixiJS 8, Vitest, Playwright; Simulation headless und deterministisch ([Regeln](../CLAUDE.md)) |
| Umfang | Hobbyprojekt, laufend erweitert ([Plan](ROADMAP.md)) |

## Pillars
1. **Original-treu.** Zahlen und Regeln kommen aus dem Wiki ([Daten mit Quellen](GAME_DATA.md)); Abweichungen sind
   Wünsche des Spielers und stehen mit Begründung im Abgleich. Neue Ideen müssen sich daran messen lassen.
2. **Schön und natürlich.** Eigene Grafik aus Blender-Skripten im Stil „Endzeit-Industrie“ auf Steppenwiese
   ([Stilbibel](ART_STYLE.md), [Herkunft](ASSET_PROVENANCE.md)); jede neue Funktion kommt mit fertiger Grafik.
3. **Die Fabrik läuft genau.** Deterministische Simulation mit 60 Takten/s und ganzzahliger Bandlogik; was angezeigt
   wird, rechnet die Simulation auch so ([Leistung](PERFORMANCE.md)).
4. **Leicht hineinfinden, tief optimieren.** Handbuch mit Verhältnissen, fertige abgestimmte Baupläne, Hinweise –
   ohne die Regeln des Originals zu vereinfachen (Ausnahmen nur auf Wunsch, siehe Entscheidungen).

## Core loop
```
abbauen → schmelzen → herstellen → forschen → neue Gebäude automatisieren → größer bauen → Gegner abwehren → …
```
- **Sekunden:** laufen, abbauen, bauen, Bänder legen ([Bänder](../src/sim/belts.ts), [Figur](../src/sim/player.ts))
- **Minuten:** Produktionsketten aufbauen und ausbalancieren ([Handbuch-Rechner](../src/sim/ratio.ts)), Strom, Forschung
- **Sitzung:** Ölverarbeitung, Züge, Roboter, Kernkraft, Raketensilo; Verschmutzung lockt Angriffe an

## Feature index

| Feature | Status | Scope | Summary | Docs |
|---|---|---|---|---|
| Förderbänder | implemented | Kern | Transportlinien mit Abständen, Spuren, Kurven, Untergrund, Splitter | [Code](../src/sim/belts.ts) · [Logistik](../src/sim/entities/logistics.ts) |
| Abbau und Bohrer | implemented | Kern | Handabbau (6× schneller, Wunsch), Brennstoff- und elektrische Bohrer | [Figur](../src/sim/player.ts) · [Daten](../src/data/entities.ts) |
| Öfen und Brennstoff | implemented | Kern | Stein-, Stahl-, Elektroofen; Brennstoffe | [Code](../src/sim/entities/basic.ts) |
| Greifarme | implemented | Kern | Takt nach Wiki, Füllgrenzen, Filter- und Massengreifarm | [Code](../src/sim/entities/inserter.ts) |
| Handwerk und Inventar | implemented | Kern | Warteschlange mit Zwischenprodukten, Schnellleiste, halber Stapel | [Figur](../src/sim/player.ts) · [HUD](../src/ui/hud.ts) |
| Montage und Rezepte | implemented | Kern | Montagemaschinen 1–3, Rezepte, Fass-Sammelrezepte | [Code](../src/sim/entities/production.ts) · [Rezepte](../src/data/recipes.ts) |
| Forschung | implemented | Kern | Baum, Warteschlange, Auslöser-Forschung, Boni, unendliche Stufen | [Code](../src/sim/research.ts) · [Daten](../src/data/tech.ts) · [Baum](../src/ui/techtree.ts) |
| Strom | implemented | Kern | Dampf, Solar, Akku (Vorrang), Masten, Netzstatistik | [Code](../src/sim/power.ts) |
| Flüssigkeiten, Öl, Chemie | implemented | Kern | Netze wie Rohrsegmente, Raffinerie, Chemie, Cracken, Anschluss-Symbole | [Flüssigkeiten](../src/sim/fluids.ts) · [Anlagen](../src/sim/entities/fluidplus.ts) |
| Kernkraft | implemented | Ausbau | Reaktor, Wärmerohre, Wärmetauscher, Turbinen, Uran | [Wärme](../src/sim/heat.ts) · [Anlagen](../src/sim/entities/nuclear.ts) |
| Züge | implemented | Ausbau | Gleise mit Bögen und Diagonalen, Bahnhöfe, Fahrpläne | [Gleise](../src/sim/rails.ts) · [Züge](../src/sim/trains.ts) |
| Roboter | implemented | Ausbau | Hangar, Bau- und Logistikroboter, persönlicher Hangar, Reparatur | [Code](../src/sim/robots.ts) |
| Schaltungsnetz | implemented | Ausbau | Rote/grüne Drähte, Kombinatoren, Bedingungen, Band lesen | [Code](../src/sim/circuit.ts) |
| Module und Leuchtfeuer | implemented | Ausbau | 9 Module, Leuchtfeuer | [Code](../src/sim/modules.ts) |
| Raketensilo | implemented | Ziel | Teile, Satellit, Weltraum-Pakete | [Code](../src/sim/entities/rocket.ts) |
| Gegner und Verschmutzung | implemented | Kern | Nester, Krabbler, Angriffe nach Verschmutzung, Entwicklung | [Gegner](../src/sim/enemies.ts) · [Verschmutzung](../src/sim/pollution.ts) |
| Militär und Rüstung | implemented | Ausbau | Türme, Mauern, Waffen, Granaten, Rüstung mit Ausrüstungsraster | [Türme](../src/sim/entities/military.ts) · [Rüstung](../src/sim/armor.ts) |
| Karte | implemented | Kern | Seed-Karte mit Seen, Flüssen, Klippen, Rohstofffeldern, Bäumen; Einstellungen | [Karte](../src/sim/map.ts) · [Werte](../src/data/mapgen.ts) |
| Kartenaufdeckung und Radar | implemented | Ausbau | Aufgedeckte Abschnitte, Radar-Scan, Kartenansicht | [Code](../src/sim/chart.ts) · [Minimap](../src/ui/minimap.ts) |
| Tag und Nacht | implemented | Grafik | Tageszeit, Nachtlicht mit Normal-Maps, leuchtende Masten | [Nacht](../src/render/night.ts) |
| Blaupausen | implemented | Komfort | Kopieren/Einfügen, Geister, Bibliothek, fertige Baupläne, Community-Format | [Code](../src/sim/blueprint.ts) · [Baupläne](../src/data/blueprints.ts) · [Import](../src/sim/foreignbp.ts) |
| Handbuch | implemented | Komfort | Rezepte, Verwendung, Verhältnis-Rechner, Faustregeln, Fundorte | [Rechner](../src/sim/ratio.ts) · [Fenster](../src/ui/handbook.ts) |
| Editor-Modus | implemented | Komfort | Spiel anhalten, alles frei bauen, Simulation zuschaltbar | [Palette](../src/ui/editor.ts) · [Spiel](../src/game/game.ts) |
| Spielstände | implemented | Kern | IndexedDB, gzip, vorherige Fassung, Umwandlungskette, Export/Import | [Format](../src/sim/serialize.ts) · [Ablage](../src/game/save.ts) |
| Fortschrittsprüfung | implemented | Qualität | Alles vom Start erreichbar (Test), Forschungshinweise | [Code](../src/sim/progression.ts) · [Test](../tests/sim/progression.test.ts) |
| Geräusche | implemented | Grafik | ZzFX aus Ereignissen der Simulation | [Code](../src/audio/sound.ts) |
| Grafik-Pipeline | implemented | Grafik | Blender-Skripte → Atlanten → WebP (SD/HD), Normal-Maps | [Skripte](../assets/blender) · [Stil](ART_STYLE.md) |
| Leistung | implemented | Qualität | Messszene, Budgets, Auflösungseinstellung | [Messungen](PERFORMANCE.md) |
| Oberfläche und Einstellungen | implemented | Komfort | Größe 100–200 %, Zustände mit Formen, Wackeln, weniger Blitzen | [Größe](../src/ui/uiscale.ts) · [Wackeln](../src/render/shake.ts) |
| Lautstärken und Tasten | implemented | Komfort | Tongruppen mit Reglern, Tastenbelegung mit Tausch bei Konflikt, Einstellungsfenster | [Ton](../src/audio/sound.ts) · [Tasten](../src/game/keys.ts) |

## Milestones
1. **M1–M4 spielbare Runde:** Bänder, Grafik-Pipeline, Produktionskette, Freeplay mit Speichern · erledigt.
2. **Phasen A–L:** Grafik, Komfort, Öl, Strom, Züge, Roboter, Gegner, Kernkraft, Radar · erledigt ([Plan](ROADMAP.md)).
3. **Skill-Durchgang (2026-11-14):** Spielstände, Erreichbarkeit, Leistung, Oberfläche, Spielgefühl, Doku, Ton/Tasten.

## Decisions

| ID | Date | Decision | Alternatives considered | Why | Affects |
|---|---|---|---|---|---|
| D-001 | 2026-11-04 | Browser, TypeScript, PixiJS 8, kein Backend | Spiele-Engine, Server | läuft überall, einfach zu teilen | alles |
| D-002 | 2026-11-04 | Simulation headless, deterministisch, 60 Takte/s; Bänder als Transportlinien | Items einzeln je Takt | Genauigkeit wie im Original, große Fabriken | Simulation |
| D-003 | 2026-11-04 | Wiki ist Quelle 1, jede Zahl mit Quelle; kein Reverse Engineering | eigene Werte | Original-treu, rechtlich sauber | Daten |
| D-004 | 2026-11-04 | Grafik nur aus Blender-Skripten → superseded by D-010 | fremde Grafiken | Lizenz, einheitlicher Stil | Grafik |
| D-005 | 2026-11 | Handabbau 6× schneller als im Original | Original-Tempo | Wunsch: weniger Klickarbeit am Anfang | Figur |
| D-006 | 2026-11 | Strommasten leuchten nach Forschung „Lampe“ | nur Lampen | Wunsch: Orientierung in der Nacht | Nacht |
| D-007 | 2026-11-11 | Fässer: nur „befüllen“/„entleeren“, Maschine erkennt Flüssigkeit | ein Rezept je Flüssigkeit (Original) | Wunsch: Übersicht | Rezepte |
| D-008 | 2026-11-13 | Editor-Modus (F2) mit Pause und freiem Bauen | nur Gottmodus | Wunsch: Ausprobieren ohne Folgen | Spiel |
| D-009 | 2026-11-14 | Bildschirmwackeln (abschaltbar), obwohl das Original keins hat | keins | Skill game-feel, Wunsch nach Durchgang | Darstellung |
| D-010 | 2026-11-14 | Grafik selbst erzeugt (Blender bevorzugt, auch Code/Bildgenerator), Herkunft dokumentiert | nur Blender | Wunsch; Lizenz bleibt sauber | Grafik |

## Open questions
- **Risiken:** Bildrate auf schwachen Grafikchips in großen Fabriken (Messung auf echter Hardware fehlt, [Leistung](PERFORMANCE.md)).
- **Offen:** Bauplan schwarze Wissenschaft (ganz oder halb), weitere Editor-Werkzeuge (Rohstoffe, Gelände, Gegner).

## Change log
**1.1 (2026-11-14):** Lautstärken und Tasten fertig, Einstellungen als eigener Bildschirm.
**1.0 (2026-11-14):** erste Spielübersicht nach dem Skill game-docs; Stand aus CLAUDE.md übernommen, Feature-Liste mit Code-Links.
