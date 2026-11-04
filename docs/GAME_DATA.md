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
| Abbaugeschwindigkeit | 0,5 → 0,5 Items/s bei Abbauzeit 1 | A |
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
5. **Strom des Greifarms:** Ein elektrischer Greifarm zwischen zwei Kisten an einem einzelnen Mast; im
   Stromnetzfenster Verbrauch im Betrieb und im Leerlauf ablesen (Projekt: ≈ 13,2 kW / 0,4 kW).
6. **Ausgabestau der Montagemaschine:** Montagemaschine mit Zahnrad-Rezept, Zutaten von Hand, kein
   Ausgabe-Greifarm. Nach 30 s die Ergebnismenge ablesen (Projekt: 2).
