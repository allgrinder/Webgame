# Eisenwerk

Ein 2D-Fabrikspiel im Browser: Erz abbauen, über Förderbänder transportieren, im Steinofen schmelzen,
mit Dampfkraft Strom erzeugen, in Montagemaschinen weiterverarbeiten und im Labor forschen.
Vite + TypeScript (strict) + PixiJS, ohne Backend. Grafik vollständig per Skript aus Blender gerendert.

## Starten

```bash
npm install
npm run dev
```

Dann im Browser öffnen:

| URL | Inhalt |
|---|---|
| http://localhost:5173/ | Freies Spiel (Start mit 8 Eisenplatten, 1 Bohrer, 1 Ofen) |
| http://localhost:5173/?scene=demo | Fertige Produktionskette, darunter Stromteil mit Montage, Labor und Logistik |
| http://localhost:5173/?scene=sandbox | Sandkasten (Bauen ohne Verbrauch, Debug-Tasten) |
| http://localhost:5173/?scene=stress | Lastszene: 5.000 Bandfelder, 10.000 Items |

Das freie Spiel erzeugt bei jedem neuen Spiel eine neue Karte und bietet beim Start „Weiterspielen“ an, wenn ein Spielstand existiert.
Weitere Parameter: `?seed=123` (feste Karte), `?new` (ohne Startdialog), `&debug` (Debug-Anzeige und -Tasten), `&warp=600` (spult beim Start 600 Ticks vor).

## Steuerung

- **WASD** laufen, **Mausrad** zoomen
- **Linksklick** bauen (Bänder durch Ziehen), **R** drehen, **Q** Gebäude/Item unter dem Cursor aufnehmen bzw. Cursor leeren
- **Rechtsklick halten** abbauen oder Gebäude aufnehmen
- **E** Inventar & Handwerk, **Klick** auf ein Gebäude öffnet dessen Slots (Montagemaschine: Rezept wählen), **Strg+Klick** überträgt einen Stapel
- **T** Forschung (Technologie wählen; Labore brauchen Strom und Wissenschaftspakete), **M** Übersichtskarte (klein/groß/aus)
- **R** auf einem Untergrundband tauscht Eingang und Ausgang
- **1–0** Schnellleiste, **Alt** Detailansicht (Ausgaberichtung, Inhalt, Status)
- **Strg+S / Strg+L** schnell speichern/laden (IndexedDB), **Esc** Menü, **H** Hilfe, **F3** Debug
- Debug: **Z/X/C/V** legt Eisenerz/Kohle/Stein/Platte auf das Band unter dem Cursor, **P** Pause

## Befehle

```bash
npm run build          # Typprüfung + Produktionsbuild nach dist/
npm test               # Vitest (Simulation, headless)
npm run e2e            # Playwright (Build + Vorschau-Server + Screenshot)
npm run assets         # Blender-Modelle rendern (nur geänderte) + Atlanten + manifest.json
npm run assets:preview # Kontaktbogen aller Sprites nach assets/preview/contact-sheet.png
npm run assets:placeholder  # einfache Platzhaltergrafik ohne Blender
```

`npm run assets` braucht Blender ≥ 4.0 im `PATH` (`blender --version`), z. B. unter Ubuntu:

```bash
sudo apt-get install blender
```

Die fertigen Assets in `public/assets/` sind eingecheckt; das Spiel läuft ohne Blender.

## Erster Weg im freien Spiel

1. Zur Kohle laufen, mit gehaltener rechter Maustaste einige Kohle abbauen.
2. Bohrer (Taste 3) auf Eisenerz setzen, mit **R** ausrichten, Ofen (Taste 4) direkt an die Ausgabe (Pfeil in der Alt-Ansicht).
3. Kohle wählen (Taste 6) und auf Bohrer und Ofen klicken (Strg+Klick: alles) – die Plattenproduktion läuft.
4. Mit **E** aus Platten Zahnräder, Greifarme und Bänder herstellen und die Kette ausbauen.
5. Kupfer schmelzen, Kabel und Schaltkreise herstellen. Am Wasser: Uferpumpe → Rohr → Kessel (Kohle) →
   Dampfmaschine, dann Strommasten zu elektrischen Bohrern und Greifarmen.
6. Labor bauen, Automatisierungspakete herstellen, mit **T** „Automatisierung“ erforschen – danach gibt es
   Montagemaschinen. Logistik schaltet Untergrundband und Splitter frei, Logistik 2 das schnelle Band.

## Leistung

`?scene=stress` zeigt bei Zoom 0,25 alle 5.000 Bandfelder und 10.000 Items gleichzeitig.
Gemessen (headless Chromium): Simulation ≈ 0,03 ms/Tick, Aufbereitung der Grafik ≈ 1,3 ms/Frame;
gezeichnet werden drei Partikel-Container (Boden, Bänder, Items) mit zusammen ≈ 22.000 Quads.

## Aufbau

- `src/data/` – alle Spieldaten (Items, Rezepte, Gebäude, Band, Spieler, Kartengenerierung)
- `src/sim/` – deterministische Simulation mit 60 Ticks/s, ohne DOM und PixiJS (Bänder, Flüssigkeiten, Strom, Forschung)
- `src/render/` – PixiJS-Renderer (interpoliert zwischen Ticks)
- `src/ui/` – DOM-Overlay (Schnellleiste, Inventar, Handwerk, Gebäudefenster, Menü)
- `src/game/` – Spielschleife, Eingabe, Szenen, Speichern/Laden
- `assets/blender/` – Blender-Skripte (headless), `scripts/` – Asset-Pipeline
- `docs/GAME_DATA.md` – alle Werte mit Quelle
