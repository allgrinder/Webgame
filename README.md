# Eisenwerk

Ein 2D-Fabrikspiel im Browser: Erz abbauen, über Förderbänder transportieren und im Steinofen schmelzen.
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
| http://localhost:5173/?scene=demo | Fertige Produktionskette |
| http://localhost:5173/?scene=sandbox | Sandkasten (Bauen ohne Verbrauch, Debug-Tasten) |
| http://localhost:5173/?scene=stress | Lastszene: 5.000 Bandfelder, 10.000 Items |

Weitere Parameter: `&seed=123` (Kartenseed), `&debug` (Debug-Anzeige und -Tasten).

## Steuerung

- **WASD** laufen, **Mausrad** zoomen
- **Linksklick** bauen (Bänder durch Ziehen), **R** drehen, **Q** Gebäude/Item unter dem Cursor aufnehmen bzw. Cursor leeren
- **Rechtsklick halten** abbauen oder Gebäude aufnehmen
- **E** Inventar & Handwerk, **Klick** auf ein Gebäude öffnet dessen Slots, **Strg+Klick** überträgt einen Stapel
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

## Aufbau

- `src/data/` – alle Spieldaten (Items, Rezepte, Gebäude, Band, Spieler, Kartengenerierung)
- `src/sim/` – deterministische Simulation mit 60 Ticks/s, ohne DOM und PixiJS
- `src/render/` – PixiJS-Renderer (interpoliert zwischen Ticks)
- `src/ui/` – DOM-Overlay (Schnellleiste, Inventar, Handwerk, Gebäudefenster, Menü)
- `src/game/` – Spielschleife, Eingabe, Szenen, Speichern/Laden
- `assets/blender/` – Blender-Skripte (headless), `scripts/` – Asset-Pipeline
- `docs/GAME_DATA.md` – alle Werte mit Quelle
