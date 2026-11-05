# Eisenwerk – Plan für die weitere Entwicklung

Leitlinie: **Die Grafik hat Vorrang und soll möglichst schön und natürlich sein.** Ladezeiten sind zweitrangig.
Jede neue Funktion kommt gleich mit fertiger Grafik. Technische Optimierung gibt es nur, wenn eine Messung
sie verlangt.

Für jeden Schritt gelten die Regeln aus `CLAUDE.md`: Werte mit Quelle in `docs/GAME_DATA.md`, Tests,
`npm run build && npm test && npm run e2e`, nach Grafikänderungen den Kontaktbogen prüfen, dann committen.

---

## Aktueller Schwerpunkt (Wunsch 04.11.2026)

Möglichst natürlich, bestehender Grafikstil bleibt. Reihenfolge:

1. **Förderbänder schöner** – U-Profil, Schrauben, Stützfüße, Gummi mit Abrieb, Umlenktrommeln, Item-Schatten. ✔
2. **Doppelte Auflösung** (128 px pro Feld) für alle Sprites. ✔
3. **Natürliche Anordnung** – Erzfelder aus mehreren verzerrten Ellipsen mit Ausläufern. ✔
4. **Wasser** – Seen und Teiche mit Ufer (Ecken-Prinzip), Schilf, Ufersteine; Wasser blockiert Laufen und Bauen. ✔
5. **Wälder** – Haine größer, Bäume und Sträucher gehäuft am Wasser. ✔
6. Danach Phase A wie unten (Gebäude behutsam im bestehenden Stil verbessern, Effekte, Einbindung).

## Phase A – Grafik-Feinschliff

Ziel: Gebäude, Figur und Effekte erreichen dieselbe Qualität wie die neue Landschaft.

**A1 Gebäude neu modellieren** ✔ (verwitterte Materialien, Bohrgut, Bruchstein-Ofen, Greifarm in 32 Winkeln; neue Anlagen in `anlagen.py`)
- Brennstoff-Bohrer: verwitterter Stahl mit Rost, Ölflecken und Staub, sichtbares Bohrgestänge im Boden,
  Abraum rund um den Bohrkopf, deutlichere Ausgaberutsche. Arbeitsanimation mit Kolben, Zahnrad und
  vibrierendem Gehäuse.
- Steinofen: Natursteine mit dem Gartenwerk-Steingenerator (`rock_mesh`, Platten-Materialien), Ruß über
  der Öffnung, glühende Kohle, Funken. Leuchtebene mit Lichtschein auf dem Boden vor dem Ofen.
- Brennstoff-Greifarm: Arm mit zwei Gelenken und Greifer. Der Arm wird in 32 Winkeln vorgerendert statt
  im Spiel gedreht, damit Licht und Schatten bei jeder Stellung stimmen.
- Förderband: Gummi mit Abnutzungsspuren, Stahlwangen mit Schrauben, Endkappen am Bandanfang und -ende,
  eigene Übergänge für seitliches Einspeisen.

**A2 Gebäude in die Landschaft einbinden** ✔ (Erd-/Kies-Decal unter Gebäuden, Kontaktschatten im Schattenbild)
- Unter jedem Gebäude ein Boden-Decal: Erde, Staub, plattgetretenes Gras.
- Kontaktschatten (Umgebungsverdeckung) am Fuß.
- Zertrampelte Wege, wo die Figur oft läuft (optional, nur Darstellung).

**A3 Effekte** ✔ (Volumen-Rauch, Funken, Staub als Partikel; Werte in `src/data/fx.ts`)
- Rauch aus den Schornsteinen von Ofen und Bohrer: in Blender gerenderte Rauchwolken als Sprite-Folge,
  im Spiel als Partikel mit Wind.
- Staub und Splitter beim Bohren und beim Handabbau.
- Funken aus dem Ofen, warmes Lichtfeld auf dem Boden.
- Items auf dem Band mit kleinem Schatten.

**A4 Spielfigur** ✔ (8 Richtungen, 16 Lauf-, 8 Ruhe-, 8 Abbau-Frames mit Spitzhacke)
- 8 Laufrichtungen mit 16 Frames, Leerlauf-Animation.
- Abbauanimation mit Spitzhacke.
- Schatten passend zur Sonne der Landschaft.

**A5 Landschaft vervollständigen** ✔ (Nadelbäume mit Sapling, Felsgruppen mit dem Rock Generator, weichere Erzränder; Wolkenschatten ✔)
- Mehr Varianten: weitere Baumarten (Kiefer und Eiche als Gruppen), Totholz, Farn- und Distelinseln,
  größere Felsgruppen.
- Erzfelder mit weichem Rand zur Wiese, Abbau sichtbar über die Dichtestufen.
- Teiche und kleine Seen mit Uferkante, Schilf und Steinen. Zunächst nur Dekoration, später Wasser für Phase C.
- Optional: sanfte Wolkenschatten, die über die Landschaft ziehen.

**A6 Oberfläche** ✔ (Metallfenster, Tooltips mit Rezept und Werten, Minimap; Rezeptbaum ✔ im Rezept-Tooltip)
- Inventar und Fenster im gleichen Materialstil (dunkles Metall, Holz), größere und schärfere Item-Symbole.
- Tooltips mit Rezept und Werten, Rezeptbaum beim Handwerk.
- Kleine Übersichtskarte (Minimap) aus den Kartendaten.

Prüfpunkte: ein Kontaktbogen je Schritt, Screenshots von Demo und Freeplay, fehlerfreie Konsole.

---

## Phase B – Komfort im bestehenden Umfang

- ✔ **Kisten** (Eisenkiste; Holzkiste entfällt mangels Holz) als Lager. Greifarme können aus Kisten nehmen und hineinlegen.
- ✔ **Items auf dem Boden:** Greifarm und Spieler können Items ablegen (wie im Vorbild).
- ✔ **Bauen:** Rückgängig machen, Bänder per Strg-Ziehen in gerader Linie, Vorschau beim Ziehen.
- **Hilfe:** Hinweise für die ersten Schritte im freien Spiel (ohne Text-Overlay im Bild, nur im HUD).
- ✔ **Spielstände:** Autosave alle 5 Minuten, Export und Import als Datei.

---

## Phase C – Neue Spielsysteme (jeweils mit Grafik und Tests)

Reihenfolge wie im Vorbild, damit sich jede Stufe aus der vorigen ergibt:

1. ✔ **Kupfer und Steinziegel:** Kupfererz, Kupferplatte, Kupferkabel, Steinziegel. Damit gibt es Rezepte
   für die Stromstufe.
2. ✔ **Flüssigkeiten und Strom:**
   - Gebäude: Offshore-Pumpe, Rohre, Kessel, Dampfmaschine, kleine Strommasten.
   - Elektrischer Bohrer und Greifarm.
   - Stromnetz-Simulation mit Erzeugung und Verbrauch je Tick. Rohre als Segmente mit Füllstand, nach dem
     gleichen Prinzip wie die Transportlinien.
3. ✔ **Montagemaschinen und Elektronik:** Montagemaschine 1, elektronischer Schaltkreis, Zahnrad- und
   Bandfertigung automatisiert.
4. ✔ **Forschung:** Labor, Wissenschaftspakete, Technologiebaum. Gebäude werden erst nach der Forschung freigeschaltet.
5. ✔ **Logistik:** Splitter, Untergrundband, schnelles Band, Greifarm mit großer Reichweite.
6. **Später, offen zu entscheiden:** Holz aus Bäumen (dann mit Kollision), Gegner, Verschmutzung,
   Tag-Nacht-Zyklus mit Lampen, Züge.

Pro Schritt: Werte aus dem Wiki bzw. aus den Prototypdaten in `docs/GAME_DATA.md`, ein Vitest-Test je Gebäude
(Durchsatz, Verbrauch), Demo-Szene erweitert, Blender-Modelle im Natur-Stil.

---

## Phase D – Technik nur bei Bedarf

Grenzwerte, gemessen in `?scene=stress` (Pflichtprüfung ab Phase C):

| Messung | Grenzwert | Maßnahme |
|---|---|---|
| Simulation pro Tick | > 4 ms | Simulation in einen Web Worker, kompakte Datenstrukturen (typisierte Arrays) |
| Grafikaufbereitung pro Bild | > 8 ms | Boden je Chunk vorrendern, WebGPU-Renderer testen |
| Grafikspeicher | Ruckeln auf Laptop | GPU-komprimierte Texturen (KTX2) |
| sehr große Fabriken | > 100.000 Bandfelder | nur die Bandsimulation in WebAssembly |

Keine Game Engine: PixiJS bleibt als Renderer, die Simulation bleibt eigener Code (Begründung siehe Gesprächsverlauf
vom 04.11.2026).

---

## Empfohlene Reihenfolge

1. A1 Gebäude → A3 Effekte → A2 Einbindung (größter sichtbarer Gewinn)
2. A4 Figur, A5 Landschaft
3. B Kisten und Komfort
4. C1 Kupfer → C2 Strom → C3 Montage → C4 Forschung → C5 Logistik
5. A6 Oberfläche begleitend, D nur bei Messbedarf
