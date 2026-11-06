# Spieldaten und Quellen

Alle Zahlenwerte stehen in `src/data/`. Diese Datei nennt für jeden Wert die Quelle.

**Hinweis zur Quellenlage:** Die Wiki-Seiten (Quelle 1) waren aus der Cloud-Instanz, in der
das Projekt entsteht, nicht erreichbar (`wiki.factorio.com` wird nicht aufgelöst). Deshalb gilt:

- Werte aus der Tabelle der Aufgabenstellung (die laut Aufgabe aus dem Wiki stammen) werden
  übernommen und, wo möglich, mit den Prototypdaten (Quelle 2,
  `github.com/wube/factorio-data`, Zweig `master`, Ordner `base/prototypes/`) abgeglichen.
- Aus den Prototypdaten wurden nur einzelne Zahlen abgelesen; es wurden keine Dateien oder
  Lua-Code ins Projekt übernommen.
- Unklare Werte sind mit **Messvorschlag** markiert (Quelle 3).

Abkürzungen: **A** = Tabelle der Aufgabenstellung, **P** = Prototypdaten (Datei angegeben),
**E** = eigener Wert (Spielgestaltung, keine Vorlage).

## Zeit und Einheiten

| Wert | Projekt | Quelle |
|---|---|---|
| Ticks pro Sekunde | 60 | A |
| Energie | ganzzahlige Joule; Leistung W → J/Tick = W/60 | E |

## Förderband (`src/data/belt.ts`)

| Wert | Projekt | Quelle |
|---|---|---|
| Positionen pro Feld | 256 | A |
| Geschwindigkeit | 8 Positionen/Tick = 1,875 Felder/s | A; P `entity/transport-belts.lua`: `speed = 0.03125` (Felder/Tick) → 0,03125 × 256 = 8 |
| Mindestabstand | 64 Positionen → 7,5 Items/s je Spur, 15 Items/s gesamt | A |
| Kurve innen / außen | 106 / 295 Positionen | A |
| Seitliches Einspeisen | 68 (spät) / 188 (früh) Positionen, gemessen als Abstand zum Feldende | A; Zuordnung „spät = stromabwärts liegende Spur des einspeisenden Bands“ ist eigene Auslegung, **Messvorschlag 1** |
| Lebenspunkte | 150 | P `transport-belts.lua`: `max_health = 150` |
| Abbauzeit | 0,1 s | P `transport-belts.lua`: `minable.mining_time = 0.1` |
| Spurversatz (Darstellung) | 0,25 Felder | E |

## Brennstoff-Bohrer (`src/data/entities.ts`)

| Wert | Projekt | Quelle |
|---|---|---|
| Größe | 2×2 | A |
| Abbaubereich | 2×2 | A; P `entity/mining-drill.lua`: `resource_searching_radius = 0.99` |
| Abbaugeschwindigkeit | 0,25 → 0,25 Erz/s bei Abbauzeit 1 (240 Ticks je Erz) | A; P `mining_speed = 0.25` |
| Leistung | 150 kW = 2.500 J/Tick → 600 kJ je Erz → 6,67 Erz je Kohle | A; P `energy_usage = "150kW"` |
| Lebenspunkte | 150 | A; P `max_health = 150` |
| Ausgabepunkt | (−0,35; −1,3) relativ zur Mitte bei Richtung Nord | P `vector_to_place_result = {-0.35, -1.3}` |
| Brennstoffslots | 1 | P `fuel_inventory_size = 1` |
| Abbauzeit (Spieler) | 0,3 s | P `minable.mining_time = 0.3` |

## Steinofen

| Wert | Projekt | Quelle |
|---|---|---|
| Größe | 2×2 | A |
| Leistung | 90 kW = 1.500 J/Tick → 0,0225 Kohle/s | A; P `entity/entities.lua`: `energy_usage = "90kW"` |
| Geschwindigkeit | 1 → 3,2 s je Eisenplatte (192 Ticks) | A; P `crafting_speed = 1` |
| Lebenspunkte | 200 | A; P `max_health = 200` |
| Slots | 1 Zutat, 1 Ergebnis, 1 Brennstoff | P `source_inventory_size = 1`, `result_inventory_size = 1`, `fuel_inventory_size = 1` |
| Abbauzeit (Spieler) | 0,2 s | P `minable.mining_time = 0.2` |

## Brennstoff-Greifarm

| Wert | Projekt | Quelle |
|---|---|---|
| Größe | 1×1 | A |
| Drehgeschwindigkeit | 0,013 Umdrehungen/Tick = 280,8°/s; halbe Drehung ≈ 38,5 Ticks | A (281°/s); P `entities.lua`: `rotation_speed = 0.013` |
| Durchsatz | ≈ 0,78 Items/s (Kiste zu Kiste, Restdrehung wird übertragen) | A („maximal etwa 0,79“) |
| Energie je Transfer | 69,4 kJ (je Halbdrehung 34,7 kJ) | A. P nennt `energy_per_movement = "50kJ"`, `energy_per_rotation = "50kJ"`; das Verbrauchsmodell der Engine dahinter ist nicht dokumentiert, daher gilt der Wiki-Wert aus A |
| Startpuffer | 500 kJ | A; P `initial_fuel = "wood"`, `initial_fuel_percent = 0.25`, Holz `fuel_value = "2MJ"` (`item.lua`) → 500 kJ |
| Leerlauf | kein Verbrauch | A |
| Aufnahme / Ablage | 1 Feld hinter / 1,2 Felder vor der Mitte | P `pickup_position = {0, -1}`, `insert_position = {0, 1.2}` (Richtungssinn im Projekt: Richtung = Ablagerichtung) |
| Lebenspunkte | 100 | P `max_health = 100` |
| Abbauzeit (Spieler) | 0,1 s | P `minable.mining_time = 0.1` |
| Zutaten-Füllgrenze | 2 Herstellvorgänge (Ofen: 2 Erz) | Wiki *Inserters* (nicht erreichbar); Wert aus Kenntnis des Verhaltens, **Messvorschlag 2** |
| Brennstoff-Füllgrenze | 5 Items | E, **Messvorschlag 3** |
| Selbstversorgung | greift Brennstoff für sich selbst, wenn sein Brennstoffslot leer ist und an der Aufnahmestelle Brennstoff liegt | A (Verhalten); Auslöser „Slot leer“ ist eigene Auslegung |

## Items (`src/data/items.ts`)

| Item | Stapel | Quelle |
|---|---|---|
| Eisenerz | 50 | P `item.lua` |
| Kohle | 50, Brennwert 4 MJ | A; P `item.lua`: `fuel_value = "4MJ"`, `stack_size = 50` |
| Stein | 50 | P `item.lua` |
| Eisenplatte | 100 | P `item.lua` |
| Zahnrad | 100 | P `item.lua` |
| Förderband | 100 | P `item.lua` |
| Brennstoff-Greifarm | 50 | P `item.lua` |
| Brennstoff-Bohrer | 50 | P `item.lua` |
| Steinofen | 50 | P `item.lua` |

## Rezepte (`src/data/recipes.ts`)

| Ergebnis | Zutaten | Zeit | Quelle |
|---|---|---|---|
| 1 Eisenplatte | 1 Eisenerz | 3,2 s (Ofen) | A |
| 1 Steinofen | 5 Stein | 0,5 s | A; P `recipe.lua` (keine Zeitangabe = Standard 0,5 s) |
| 1 Zahnrad | 2 Eisenplatten | 0,5 s | A |
| 1 Brennstoff-Greifarm | 1 Zahnrad, 1 Eisenplatte | 0,5 s | A; P `recipe.lua` |
| 1 Brennstoff-Bohrer | 3 Zahnräder, 3 Eisenplatten, 1 Steinofen | 2 s | A; P `recipe.lua`: `energy_required = 2` |
| 2 Förderbänder | 1 Zahnrad, 1 Eisenplatte | 0,5 s | A („prüfen“) → **bestätigt** durch P `recipe.lua`: `results = … amount = 2` |

## Spieler (`src/data/player.ts`)

| Wert | Projekt | Quelle |
|---|---|---|
| Abbaugeschwindigkeit | 0,5 (Original) × 3 Handabbau-Faktor für Rohstoffe (Wunsch, bewusste Abweichung) → 1,5 Items/s bei Abbauzeit 1 | A |
| Reichweite Bauen / Gebäude | 10 Felder | P `entities.lua` (character): `build_distance = 10`, `reach_distance = 10` |
| Reichweite Ressourcen | 2,7 Felder | P `reach_resource_distance = 2.7` |
| Laufgeschwindigkeit | 0,15 Felder/Tick ≈ 8,9 Felder/s (Diagonale × 181/256) | P `running_speed = 0.15` |
| Inventar | 80 Slots | P `inventory_size = 80` |
| Startausrüstung | 8 Eisenplatten, 1 Brennstoff-Bohrer, 1 Steinofen | A |
| Kollisionsradius | 0,2 Felder | E |

## Ressourcen und Karte (`src/data/resources.ts`, `src/data/mapgen.ts`)

| Wert | Projekt | Quelle |
|---|---|---|
| Abbauzeit Eisenerz, Kohle, Stein | 1 | P `entity/resources.lua`: `mining_time = 1` |
| Feldgrößen, Mengen, Lage, Dichtestufen | eigene Werte | E |
| Seen und Teiche (Rauschen, Schwellwert, Abstand zum Start) | `src/data/mapgen.ts` | E |
| Feuchte (Landschaftsräume), Flüsse mit Furten, Startsee | `src/data/mapgen.ts` | E |
| Bodenfarbe nach Fruchtbarkeit, Bewuchs je Landschaftsraum, Wolkenschatten | `src/data/decor.ts`, `src/data/fx.ts`, nur Darstellung | E |
| Erzfeldform (Teilellipsen, Verzerrung, Ausläufer) | `src/data/mapgen.ts` | E |
| Dekoration (Dichte, Haine, Abstände zu Start und Erz) | `src/data/decor.ts`, nur Darstellung | E |

## Kupfer, Ziegel, Zwischenprodukte

| Wert | Projekt | Quelle |
|---|---|---|
| Kupfererz | Stapel 50, Abbauzeit 1 | P `item.lua`, `entity/resources.lua` |
| Kupferplatte | 1 Kupfererz → 1 Platte, 3,2 s (Ofen) | P `recipe.lua` |
| Steinziegel | 2 Stein → 1 Ziegel, 3,2 s (Ofen) | P `recipe.lua` |
| Kupferkabel | 1 Kupferplatte → 2 Kabel, 0,5 s; Stapel 200 | P `recipe.lua`, `item.lua` |
| Eisenstange | 1 Eisenplatte → 2 Stangen, 0,5 s | P `recipe.lua` |
| Elektronischer Schaltkreis | 1 Eisenplatte + 3 Kupferkabel, 0,5 s; Stapel 200 | P `recipe.lua`, `item.lua` |
| Eisenkiste | 8 Eisenplatten, 0,5 s; 32 Slots | P `recipe.lua`, `entity/entities.lua`: `inventory_size = 32` |
| Holzkiste | entfällt (kein Holz im Spiel, Bäume nur Dekoration) | E |

## Flüssigkeiten und Strom (`src/data/fluids.ts`, `src/data/entities.ts`)

| Wert | Projekt | Quelle |
|---|---|---|
| Mengen | ganzzahlig in Tausendstel Einheiten | E |
| Netzmodell | verbundene Behälter teilen einen Vorrat (wie Rohrsegmente) | E, angelehnt an das Verhalten von Rohrnetzen |
| Wasser / Dampf | Wärmekapazität 0,2 kJ/(Einheit·°C), Wasser 15 °C | P `fluid.lua`: `heat_capacity = "0.2kJ"`, `default_temperature = 15` |
| Rohr | Fassung 100 | P `entity/entities.lua` (pipe): `fluid_box.volume = 100` |
| Uferpumpe | 20 Einheiten/Tick = 1.200/s; ohne Strom | P `entity/entities.lua`: `pumping_speed = 20` |
| Uferpumpe, Größe | 1×1 (Rücken zum Wasser) | Abweichung: Vorbild 1×2; vereinfacht, E |
| Kessel | 3×2, 1,8 MW, Zieltemperatur 165 °C, Fassung 200 | P `boiler.lua`: `energy_consumption = "1.8MW"`, `target_temperature = 165` |
| Kessel-Durchsatz | 60 Einheiten Dampf/s (1,8 MW / (150 °C × 0,2 kJ)) | abgeleitet |
| Dampfmaschine | 3×5, 0,5 Einheiten/Tick, 900 kW | P `entity/entities.lua`: `fluid_usage_per_tick = 0.5`, `maximum_temperature = 165` → 30 /s × 30 kJ |
| Kleiner Strommast | Kabel 7,5 Felder, Versorgung 2,5 Felder (5×5) | P `entity/entities.lua`: `maximum_wire_distance = 7.5`, `supply_area_distance = 2.5` |
| Kleiner Strommast, Rezept | 1 Eisenstange + 2 Kupferkabel → 2 Masten | Abweichung: Vorbild Holz + Kupferkabel; Holz gibt es nicht, E |
| Stromverteilung | anteilig nach Bedarf; Maschinen werden bei Mangel anteilig langsamer | E, angelehnt an das Verhalten |
| Elektrischer Bohrer | 3×3, Abbaubereich 5×5, 0,5/s, 90 kW, Lebenspunkte 300 | P `mining-drill.lua`: `mining_speed = 0.5`, `energy_usage = "90kW"`, `resource_searching_radius = 2.49` |
| Greifarm (elektrisch) | 0,014 U/Tick, Grundlast 0,4 kW, ≈ 15,7 kJ je Transfer | P `entities.lua`: `rotation_speed = 0.014`, `drain = "0.4kW"`; Energie je Transfer aus der Wiki-Angabe 13,2 kW Betrieb × Zyklus abgeleitet (Wiki nicht erreichbar, **Messvorschlag 5**) |
| Langer Greifarm | 0,02 U/Tick, Aufnahme 2 / Ablage 2,2 Felder, ≈ 16,7 kJ je Transfer | P `entities.lua`: `rotation_speed = 0.02`, `pickup_position = {0, -2}`, `insert_position = {0, 2.2}`; Energie wie oben abgeleitet aus 20 kW |
| Rezepte | Rohr 1 Platte; Uferpumpe 3 Rohre + 2 Zahnräder; Kessel 1 Steinofen + 4 Rohre; Dampfmaschine 8 Zahnräder + 5 Rohre + 10 Platten; elektrischer Bohrer 3 Schaltkreise + 5 Zahnräder + 10 Platten (2 s); Greifarm 1 Schaltkreis + 1 Zahnrad + 1 Platte; langer Greifarm 1 Greifarm + 1 Zahnrad + 1 Platte | P `recipe.lua` |

## Montage und Forschung (`src/data/entities.ts`, `src/data/tech.ts`)

| Wert | Projekt | Quelle |
|---|---|---|
| Montagemaschine 1 | 3×3, Geschwindigkeit 0,5, 75 kW, Grundlast 2,5 kW | P `entity/entities.lua`: `crafting_speed = 0.5`, `energy_usage = "75kW"`; Grundlast = Standard 1/30 der Leistung |
| Montagemaschine, Rezept | 3 Schaltkreise + 5 Zahnräder + 9 Platten, 0,5 s | P `recipe.lua` |
| Montagemaschine, Ausgabe | stoppt, solange zwei Ergebnisse warten | E, **Messvorschlag 6** |
| Labor | 3×3, 60 kW, Grundlast 2 kW (1/30), Forschungsgeschwindigkeit 1 | P `entity/entities.lua`: `energy_usage = "60kW"`, `researching_speed = 1` |
| Labor, Rezept | 10 Schaltkreise + 10 Zahnräder + 4 Bänder, 2 s; Stapel 10 | P `recipe.lua`, `item.lua` |
| Paketverbrauch | je Einheit ein Paket jeder Sorte, dann `time` Sekunden Laborarbeit | E, angelehnt an das Verhalten (Teilverbrauch eines Pakets wird nicht nachgebildet) |
| Automatisierungs-Paket | 1 Kupferplatte + 1 Zahnrad, 5 s; Stapel 200 | P `recipe.lua`, `item.lua` |
| Logistik-Paket | 1 Greifarm + 1 Band, 6 s; Stapel 200 | P `recipe.lua`, `item.lua` |
| Technologien | Automatisierung 10 × 10 s; Logistik 20 × 15 s; Logistik-Wissenschaft 75 × 5 s; Logistik 2: 200 × 30 s (rot + grün) | P `technology.lua` (`unit.count`, `unit.time`, `prerequisites`, `effects`) |
| Freischaltungen | Automatisierung → Montagemaschine, langer Greifarm; Logistik → Untergrundband, Splitter; Logistik-Wissenschaft → grünes Paket; Logistik 2 → schnelles Band | P `technology.lua` |

## Logistik (`src/data/belt.ts`, `src/data/entities.ts`)

| Wert | Projekt | Quelle |
|---|---|---|
| Schnelles Band | 16 Positionen/Tick = 3,75 Felder/s, 30 Items/s | P `transport-belts.lua`: `speed = 0.0625` → × 256 = 16 |
| Geschwindigkeitswechsel | Linien enden am Wechsel, gerade Übergabe in dieselbe Spur | E |
| Untergrundband | größter Abstand 5 Felder, Geschwindigkeit wie gelbes Band | P `transport-belts.lua`: `max_distance = 5` |
| Untergrundband, Strecke | Eingang bis Mitte des Ausgangs als ein Linienstück; ab der Eingangsmitte unsichtbar | E |
| Splitter | 2×1; je Spur abwechselnd auf beide Ausgänge, bei Stau alles auf den freien | E, angelehnt an das Verhalten (Vorrang/Filter fehlen) |
| Rezepte | schnelles Band 5 Zahnräder + 1 Band; Untergrundband 10 Platten + 5 Bänder → 2 (1 s); Splitter 5 Schaltkreise + 5 Platten + 4 Bänder (1 s) | P `recipe.lua` |
| Seitliches Einspeisen in Untergrund/Splitter | nicht möglich | Abweichung, E |

## Korrekturen nach Wiki-Abgleich (05.11.2026, Quelle 1 = Wiki, siehe `docs/WIKI_ABGLEICH.md`)

Das Wiki ist inzwischen erreichbar; diese Werte ersetzen frühere Angaben in den Tabellen oben.

| Wert | Projekt | Quelle |
|---|---|---|
| Kessel | 1 Wasser → 10 Dampf (`steamPerWater`) | Wiki „Boiler“ |
| Greifarm-Takt | ganze Ticks je Halbdrehung: 38 / 35 / 24 (Zyklus 76 / 70 / 48 Ticks) | Wiki „Inserters“, Inserter speed |
| Greifarm-Energie je Zyklus | 66,9 kJ / 6,65 kJ / 7 kJ (Brennstoff / Greifarm / lang); Grundlast 0,4 kW | Wiki „Inserters“, Energy costs |
| Füllgrenze Maschinen und Labore | Zutaten für 1 Vorgang + Vorgänge in 1,166 s (aufgerundet), mind. 2, höchstens 100 | Wiki „Inserters“, Insertion limits (erledigt **Messvorschlag 2**) |
| Brennstoff-Füllgrenze | 5 | Wiki „Inserters“ (erledigt **Messvorschlag 3**) |
| Ablage/Aufnahme auf Bändern | quer: ferne Spur / zuerst nahe Spur; längs: rechte Spur / zuerst linke Spur | Wiki „Inserters“ |
| Labor | Greifarme reichen Pakete an ein Labor weiter; Labor bezahlt eine Einheit erst mit Strom | Wiki „Inserters“, Cheatsheet |
| Splitter | Eingangs- und Ausgangsvorrang, Filter (Filterseite = Vorrangseite) | Wiki „Belt transport system“ |
| Untergrundband | seitliches Einspeisen nur auf der Bandhälfte (Eingang früh 188, Ausgang spät 68) | Wiki „Belt transport system“, „Transport belts/Physics“ |
| Uferpumpe | 1×2 Felder, hinteres Feld im Wasser | Wiki Infobox (2×1) |
| Auslöser-Forschung | Dampfkraft: 50 Eisenplatten; Elektronik: 10 Kupferplatten; Automatisierungs-Wissenschaft: 1 Labor (nach Dampfkraft + Elektronik); Elektrischer Bohrer 25 × 10 s rot | Wiki Infoboxen (technology-trigger, cost) |
| Schnelles Untergrundband | Lücke 6 (maxDistance 7), 2 s: 40 Zahnräder + 2 Untergrundbänder → 2 | Wiki, Cheatsheet |
| Schneller Splitter | 2 s: 10 Schaltkreise + 10 Zahnräder + 1 Splitter | Wiki |

## Holz und Bäume (Quelle: Wiki „Wood“, Infobox „Tree“)

| Wert | Projekt | Quelle |
|---|---|---|
| Holz | Stapel 100, Brennwert 2 MJ | Wiki Infobox „Wood“ |
| Baum / abgestorbener Baum | 4 / 2 Holz, Abbauzeit 0,55 / 0,5 s (Spieler 0,5 → 1,1 / 1,0 s) | Wiki „Wood“, Infobox „Tree“ |
| Startausrüstung | 8 Eisenplatten, 1 Holz, Brennstoff-Bohrer, Steinofen (Pistole/Munition folgen mit den Gegnern) | Wiki „Wood“, Quick start guide |
| Holzkiste | 2 Holz, 0,5 s; 16 Plätze, 100 LP | Wiki Infobox |
| Kleiner Strommast | 1 Holz + 2 Kupferkabel → 2 | Wiki Infobox |
| Baumverteilung (Raster, Haine, Fruchtbarkeit) | `src/data/mapgen.ts` (`trees`) | E |

## Frühe Phase (Quelle: Wiki-Infoboxen)

| Item/Gebäude | Rezept | Werte | Forschung |
|---|---|---|---|
| Stahlplatte | 5 Eisenplatten, 16 s (Ofen) | Stapel 100 | Stahlverarbeitung 50 × 5 s rot |
| Stahlkiste | 8 Stahl, 0,5 s | 48 Plätze, 350 LP | Stahlverarbeitung |
| Stahlofen | 6 Stahl + 10 Ziegel, 3 s | 2×2, Geschwindigkeit 2, 90 kW | Fortgeschrittene Materialverarbeitung 75 × 30 s rot+grün |
| Schneller Greifarm | 2 Schaltkreise + 1 Greifarm + 2 Platten | 0,04 U/Tick, 24 Ticks je Zyklus, 8,12 kJ je Zyklus, Grundlast 0,5 kW | Schneller Greifarm 30 × 15 s rot |
| Mittlerer Strommast | 2 Kabel + 4 Eisenstangen + 2 Stahl | Kabel 9, Versorgung 7×7 | Energieverteilung 1 120 × 30 s rot+grün |
| Großer Strommast | 4 Kabel + 8 Eisenstangen + 5 Stahl | 2×2, Kabel 32, Versorgung 4×4 | Energieverteilung 1 |
| Eisenstange | 1 Platte → 2 | – | Energieverteilung 1 (2.0) |
| Lampe | 3 Kabel + 1 Schaltkreis + 1 Platte | 5 kW | Lampe 10 × 15 s rot |
| Montagemaschine 2 | 1 Montagemaschine 1 + 3 Schaltkreise + 5 Zahnräder + 2 Stahl | 0,75, 150 kW, Grundlast 5 kW, 350 LP | Automatisierung 2 40 × 15 s rot+grün |
| Landaufschüttung | 50 Stein | 1 Wasserfeld → Land | Landaufschüttung 50 × 30 s rot+grün |
| Motor | 1 Zahnrad + 2 Rohre + 1 Stahl, 10 s, nur Montagemaschine | Stapel 50 | Motor 100 × 15 s rot+grün |
| Pumpe | 1 Motor + 1 Rohr + 1 Stahl, 2 s | 1×2, 1200/s, 30 kW | Flüssigkeitshandhabung 50 × 15 s rot+grün |
| Lagertank | 20 Platten + 5 Stahl, 3 s | 3×3, 25.000 | Flüssigkeitshandhabung |
| Rohr unterirdisch | 5 Platten + 10 Rohre → 2 | bis 10 Felder (9 Lücke), Volumen wie 2 Rohre | Dampfkraft |

Abweichungen: Fässer (Flüssigkeitshandhabung) und Reparaturset fehlen noch (Reparatur erst mit Schaden/Gegnern).
Die Lampe leuchtet, sobald sie Strom hat (noch kein Tag-Nacht-Wechsel).

## Öl und Chemie (Quelle: Wiki-Infoboxen „Pumpjack“, „Oil refinery“, „Chemical plant“, „Oil processing“)

| Gebäude | Größe | Werte | Rezept | Forschung |
|---|---|---|---|---|
| Pumpjack | 3×3, nur mittig auf einer Quelle | 90 kW, Fördergeschwindigkeit 1, 10 Rohöl/s je 100 % Ergiebigkeit | 5 Schaltkreise + 10 Zahnräder + 10 Rohre + 5 Stahl, 5 s | Ölgewinnung 100 × 30 s rot+grün |
| Ölraffinerie | 5×5, 2 Eingänge Süd, 3 Ausgänge Nord | Geschwindigkeit 1, 420 kW, Grundlast 14 kW | 10 Schaltkreise + 10 Zahnräder + 10 Rohre + 15 Stahl + 10 Ziegel, 8 s | Ölverarbeitung (Auslöser: Rohöl fördern) |
| Chemiefabrik | 3×3, 2 Eingänge Süd, 2 Ausgänge Nord | Geschwindigkeit 1, 210 kW, Grundlast 7 kW | 5 Schaltkreise + 5 Zahnräder + 5 Rohre + 5 Stahl, 5 s | Ölverarbeitung |
| Elektrischer Ofen | 3×3 | Geschwindigkeit 2, 180 kW, Grundlast 6 kW | 5 fortgeschr. Schaltkreise + 10 Stahl + 10 Ziegel, 5 s | Fortgeschr. Materialverarbeitung 2 |
| Umspannwerk | 2×2 | Kabel 18, Versorgung 18×18 | 5 fortgeschr. Schaltkreise + 6 Kabel + 10 Stahl, 0,5 s | Energieverteilung 2 |
| Express-Band / -Untergrund / -Splitter | – | 45 Items/s (24 Positionen/Tick), Untergrund bis 9 Lücke | mit 20 / 40 / 80 Schmiermittel (Montage 2) | Logistik 3 (folgt mit Block 4) |

Rohölquellen: Ergiebigkeit 60–200 % (+0,25 % je Feldabstand, `src/data/mapgen.ts`), 4–10 Quellen je Feld, nicht
näher als 70 Felder am Start. Erschöpfung: alle 300 Förderzyklen −1 %, Untergrenze 20 % bzw. 20 % des Startwerts
(Wiki „Crude oil“). Grundverarbeitung 100 Rohöl → 45 Erdgas, 5 s; fortgeschritten 100 Rohöl + 50 Wasser →
25 Schweröl + 45 Leichtöl + 55 Erdgas, 5 s; Cracken 40 S + 30 W → 30 L bzw. 30 L + 30 W → 20 E, je 2 s.
Chemie (je Wiki-Rezept): Kunststoff 1 Kohle + 20 Erdgas → 2 (1 s), Schwefel 30 E + 30 W → 2 (1 s),
Schwefelsäure 1 Eisen + 5 Schwefel + 100 W → 50 (1 s), Batterie 1 Eisen + 1 Kupfer + 20 Säure (4 s),
Schmiermittel 10 Schweröl → 10 (1 s), Festbrennstoff 10 L / 20 E / 20 S (1 s), Sprengstoff 1 Kohle + 1 Schwefel + 10 W → 2 (4 s).
Fortgeschrittener Schaltkreis 4 Kabel + 2 Schaltkreise + 2 Kunststoff (6 s), Elektromotor 2 Schaltkreise + 1 Motor +
15 Schmiermittel (10 s, Montage 2), Chemie-Wissenschaftspaket 3 fortgeschr. Schaltkreise + 2 Motoren + 1 Schwefel → 2 (24 s).

## Solar und Akkumulator (Quelle: Infoboxen „Solar panel“, „Accumulator“, Wiki „Electric system“)

| Gebäude | Werte | Rezept | Forschung |
|---|---|---|---|
| Solarpanel 3×3 | 60 kW × (1 − Dunkelheit), Vorrang vor Dampf | 5 Kupfer + 15 Schaltkreise + 5 Stahl, 10 s | Solarenergie 250 × 30 s rot+grün |
| Akkumulator 2×2 | 5 MJ, Laden/Entladen je 300 kW | 5 Batterien + 2 Eisen, 10 s | Akkumulatoren 150 × 30 s rot+grün |

Verteilung je Tick: Bedarf aus Solar, Rest aus Dampf, dann aus Akkus; Überschuss (Solar zuerst) lädt die Akkus.

## Module und Leuchtfeuer (Quelle: Wiki „Module“, „Beacon“, Infoboxen)

| Modul | Tempo | Produktivität | Verbrauch | Rezept |
|---|---|---|---|---|
| Geschwindigkeit 1/2/3 | +20/30/50 % | – | +50/60/70 % | 5 fortgeschr. + 5 Schaltkreise, 15 s; Stufe 2/3: 5 fortgeschr. + 5 Prozessoren + 4 Vorstufe, 30/60 s |
| Produktivität 1/2/3 | −5/10/15 % | +4/6/10 % | +40/60/80 % | wie oben |
| Effizienz 1/2/3 | – | – | −30/40/50 % | wie oben |

Untergrenze Tempo/Verbrauch 20 %. Produktivität nur bei Zwischenprodukten (`PRODUCTIVITY_RECIPES`), nicht im Leuchtfeuer.
Leuchtfeuer 3×3, 2 Plätze, 480 kW, Bereich 9×9, Übertragung 1,5/√n. Modulplätze: Montage 2/3: 2/4, el. Bohrer 3,
Labor 2, Chemiefabrik 3, Raffinerie 3, E-Ofen 2, Pumpjack 2, Raketensilo 4. Montagemaschine 3: 1,25, 375 kW, 12,5 kW.

## Roboter (Quelle: Infoboxen „Roboport“, „Logistic robot“, „Construction robot“)

Hangar 4×4: Logistik 50×50, Bau 110×110, 7 Roboterplätze, 4 Ladeplätze à 500 kW, Nachladen 2,1 MW, Grundlast 50 kW,
Speicher 100 MJ (Quelle 2). Bauroboter 0,06 Felder/Tick, 75,9 kW, 3 MJ; Logistikroboter 0,05 Felder/Tick, 63,75 kW,
1,5 MJ; ohne Ladung 20 % Tempo; Ladung 1 Item. Aufgabenverteilung alle 10 Ticks (Messvorschlag).

## Schaltungsnetz (Quelle: Wiki „Circuit network“ und Kombinator-Seiten)

Konstanter Kombinator 1×1, Rechen-/Entscheidungskombinator 1×2 (1 kW), Ausgabe einen Tick später, Werte 32-Bit.
Drahtreichweite 9 Felder für Nicht-Masten (Quelle 2), Masten nach ihrer Kabelreichweite.

## Züge (Quelle: Wiki „Locomotive“, Infoboxen „Locomotive“, „Cargo wagon“, „Train stop“, „Rail“)

Je Tick: v = max(0, v − Reibung/Gewicht); v += 10 × Loks × Brennstoffbonus / Gewicht; v × (1 − Luftwiderstand/(Gewicht/1000));
Höchsttempo 1,2 × Bonus; Bremsen v − Bremskraft/Gewicht. Lok 2000 / 0,0075 / 0,5 / 10, Wagen 1000 / 0,01 / 0,5 / 3.
Lok 600 kW, 3 Brennstoffplätze; Güterwagen 40 Plätze; Abstand 7. Schiene: 1 Stein + 1 Eisenstange + 1 Stahl → 2.
Bogen 4 Schienen (1.1-Wert, Bögen hier vereinfacht). Lok: 10 Schaltkreise + 20 Motoren + 30 Stahl, 4 s.

## Raketensilo (Quelle: Wiki „Rocket silo“, „Satellite“, Infobox „Cargo landing pad“)

Silo 9×9, 4 MW, Tempo 1, 4 Module; Raketenteil 10 Leichtbauteile + 10 Prozessoren + 10 Raketentreibstoff, 3 s;
100 Teile je Rakete; 1632 Ticks je Start; Satellit → 1000 Weltraum-Pakete am Fracht-Landeplatz (8×8, 80 Plätze) ~29 s
nach dem Start. Erster Start: Sieg.

## Gottmodus (Testhilfe, nicht im Original, `src/data/player.ts` GOD)

Link `?god` startet eine neue Runde: Handabbau 40 Stück/s, Bäume und Gebäude sofort, Handwerk ×20, Labore ×20,
Laufen ×2, Reichweite ×3. Der Modus wird im Spielstand gespeichert. Volles Inventar beim Handwerk: Ergebnis wird neben die Figur
geschüttet (wie im Original), nicht mehr verworfen.

## Messvorschläge (Quelle 3)

1. **Seitliches Einspeisen, Spurzuordnung:** Hauptband 5 Felder nach Osten. Von Süden ein Band auf
   das 3. Feld. Auf dem Zubringer nur die *linke* Spur mit Eisenerz, die rechte mit Kohle belegen.
   Prüfen: Liegt auf dem Hauptband die Kohle (stromabwärts) vor oder hinter dem Erz, wenn beide
   gleichzeitig eintreffen? Erwartung im Projekt: Items der stromaufwärts liegenden Zubringerspur
   werden früher (188) eingefügt.
2. **Zutaten-Füllgrenze Ofen:** Band voll Eisenerz → Brennstoff-Greifarm → Steinofen ohne Brennstoff.
   Nach 30 s den Ofen öffnen und die Erzmenge im Zutatenslot ablesen (Erwartung: 2).
3. **Brennstoff-Füllgrenze:** Band voll Kohle → Brennstoff-Greifarm → Steinofen ohne Erz.
   Nach 60 s die Kohlemenge im Brennstoffslot des Ofens ablesen (Projekt: 5).
4. **Greifarm-Durchsatz:** Kiste mit 100 Platten → Brennstoff-Greifarm → Kiste. Zeit für 50 Items
   stoppen (Erwartung ≈ 64 s bei 0,78 Items/s).
5. ~~Strom des Greifarms~~ – erledigt durch Wiki (6,65 kJ je Zyklus, Grundlast 0,4 kW).
6. **Ausgabestau der Montagemaschine:** Montagemaschine mit Zahnrad-Rezept, Zutaten von Hand, kein
   Ausgabe-Greifarm. Nach 30 s die Ergebnismenge ablesen (Projekt: 2).

## Karteneinstellungen (neue Runde, Wunsch 05.11.2026)

| Wert | Eisenwerk | Quelle |
|---|---|---|
| Rohstoffe leicht / mittel / schwer | Menge je Feld × 25 / × 4 / × 1 (Grundwerte) | Wunsch („leicht fast unendlich, schwer wie bisher“); Original: Einstellung „Reichtum“ |
| Feldgröße | × 1,8 gegenüber den Grundwerten (Radius), Startfelder entsprechend weiter weg | Wunsch („deutlich größer“); Original: Einstellung „Größe“ |
| Alte Spielstände | ohne gespeicherte Einstellung: Größe 1, schwer, keine Gegner (Karte bleibt gleich) | – |
| Handabbau Rohstoffe | Abbautempo 0,5 × 3 | Wunsch (bewusste Abweichung) |

## Gegner, Verschmutzung, Militär (Wunsch 05.11.2026, Wiki-Abgleich 06.11.2026)

Eigene Gestaltung: „Krabbler“ (Vorbild Beißer) und „Nest“ (Vorbild Spawner). Werte in `src/data/enemies.ts`.
Quelle W = Wiki (direkt gelesen: „Pollution“, „Enemies“, Infoboxen), M = Messvorschlag/Vereinfachung.

| Wert | Eisenwerk | Quelle |
|---|---|---|
| Verschmutzung/min | Brennstoff-Bohrer 12, E-Bohrer 10, Steinofen 2, Stahlofen 4, Elektroofen 1, Kessel 30, Montage 1/2/3: 4/3/2, Pumpjack 10, Raffinerie 6, Chemiefabrik 4 | W Infoboxen |
| Verteilung | ab 15 je Abschnitt 2 % je 64 Ticks in jeden der 4 Nachbarn | W „Pollution“ |
| Aufnahme Boden | Gras/Erde 0,000018/s je Feld = 1,106 je Abschnitt und Minute | W „Pollution“ (Tabelle) |
| Aufnahme Bäume | 0,001/s je Baum | W „Pollution“ (Trees, volle Belaubung) |
| Aufnahme Nest | je 64 Ticks 20 + 1 % (wenn > 20), bis 3× Kosten der teuersten Einheit | W „Pollution“ |
| Angriff | gesammelte Angreifer starten nach zufällig 1–10 min | W „Pollution“ |
| Kleiner / mittlerer / großer Krabbler | LP 15 / 75 / 375, Schaden 7 / 15 / 30 (1,71/s), Reichweite 0,5 / 1 / 1,5, Tempo 43,2 / 51,8 / 49,7 km/h (0,2 / 0,24 / 0,23 Felder/Tick), Verschmutzung 4 / 20 / 80, Panzerung physisch 0 / 4+10 % / 8+10 % | W „Enemies“ |
| Nest | 350 LP, Regeneration 1,2/s, Panzerung physisch 2 / 15 %, Nachschub alle 360 → 150 Ticks mit der Entwicklung, bis 5 Verteidiger, 5×5 | W „Enemies“ (LP, Regeneration, Panzerung, Takt); Verteidigerzahl M; LP-Zuwachs mit Entwicklung fehlt |
| Entwicklung | Zeit 0,000004/s, Nest 0,002, Verschmutzung 0,0000009 je Einheit; jeder Zuwachs × (1 − Entwicklung)² | W „Enemies“ (Evolution) |
| Arten nach Entwicklung | mittlere ab 0,2, große ab 0,5 | M (Wiki zeigt nur Diagramme) |
| Geschützturm | 2×2, 400 LP, Reichweite 18, 10 Schuss/s; 10 Kupfer + 10 Zahnräder + 20 Eisen, 8 s | W „Gun turret“ |
| Magazin | 5 Schaden, 10 Schuss; 4 Eisenplatten, 1 s | W „Firearm magazine“ |
| Panzerbrechendes Magazin | 8 Schaden, 10 Schuss; 2 Kupfer + 2 Magazine + 1 Stahl → 2 Stück, 6 s | W „Piercing rounds magazine“ (2.0) |
| Pistole / Maschinenpistole | Reichweite 15 / 18, 4 / 10 Schuss/s; MP: 5 Kupfer + 10 Zahnräder + 10 Eisen, 10 s | W |
| Steinmauer | 350 LP, 5 Ziegel, 0,5 s | W „Wall“ |
| Reparaturset | 2 Schaltkreise + 2 Zahnräder, 0,5 s, Haltbarkeit 300; 2 LP je Tick | W (Rezept, Haltbarkeit, Forschung), M (Tempo) |
| Forschung | Militär 10×15 s rot (MP); Geschützturm 10×10 s rot; Steinmauer 10×10 s rot; Reparaturset 25×10 s rot; Militär 2 20×15 s rot+grün (panzerbrechend) | W Infoboxen |
| Spielfigur | 250 LP, Heilung 0,15/Tick nach 10 s ohne Treffer; Tod: Neustart am Start, Inventar bleibt | W „Character“; Tod vereinfacht (M) |
| Start | Pistole + 10 Magazine | W „Freeplay“ |
| Nester auf der Karte | Raster 96 Felder, 35 % je Zelle, 2–5 Nester je Basis, frei im Umkreis 140 um den Start (stark: 80/50 %/3–7/110) | M |
