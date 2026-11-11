# Abgleich mit dem Wiki (Stand 05.11.2026)

Quellen: wiki.factorio.com (alle 588 Infoboxen per API, dazu die Seiten Inserters, Transport belts/Physics,
Boiler, Mining, Player, Wood, Quick start guide) und factoriocheatsheet.com (Version 2.0.7).
Das Wiki beschreibt Version 2.x. Verglichen wurde nur das Basisspiel (Infoboxen ohne `space-age = yes`).
Nur einzelne Zahlen übernommen, keine Texte oder Grafiken.

## 1. Was bereits stimmt

- Alle 27 Rezepte stimmen exakt (Zeit, Zutaten, Menge), außer dem Strommast (siehe 2.9).
- Stapelgrößen, Lebenspunkte, Abbauzeiten, Größen, Leistungen, Geschwindigkeiten aller 19 Gebäude.
- Band: 256 Positionen je Feld, 8 Positionen/Tick, 4 Items je Feld und Spur, Kurven 106/295,
  seitliches Einspeisen 68 (spät) / 188 (früh), Untergrundband max. 4 Felder Lücke.
- Spieler: Abbaugeschwindigkeit 0,5, Laufen 8,9 Felder/s, Reichweite 10.
- Messvorschlag 2 (Erz-Füllgrenze Ofen = 2) und 3 (Brennstoff-Füllgrenze 5) sind durch das Wiki bestätigt.
- Technologien Automatisierung, Logistik, Logistik-Wissenschaft, Logistik 2: Kosten und Freischaltungen stimmen.

## 2. Abweichungen, die korrigiert werden sollten

| # | Thema | Wiki | Eisenwerk |
|---|---|---|---|
| 2.1 | Kessel | 1 Wasser → 10 Dampf (6 Wasser/s → 60 Dampf/s) | 1 Wasser → 1 Dampf |
| 2.2 | Greifarm-Zyklus | ganze Ticks je Halbdrehung, abgerundet: 76 / 70 / 48 Ticks je Zyklus (Brennstoff / Greifarm / lang) | Rest wird übertragen: ≈ 76,9 / 71,4 / 50 Ticks |
| 2.3 | Greifarm-Energie je Zyklus | 66,9 kJ / 6,65 kJ / 7 kJ, Höchstleistung 15,1 kW bzw. 21,4 kW | 69,4 / 15,7 / 16,7 kJ |
| 2.4 | Füllgrenze Montage/Labor | Zutaten für 1 Vorgang + Vorgänge, die in 1,166 s fertig werden (aufgerundet), mind. 2, höchstens 100 | fest ≈ 2 Vorgänge |
| 2.5 | Labor | Greifarme können Pakete aus einem Labor ins nächste weiterreichen | Labor gibt nichts ab |
| 2.6 | Ablage auf Bänder | Greifarm legt auf die ferne Spur, bei gleicher/entgegengesetzter Richtung auf die rechte Spur | Spur nach Ablagepunkt |
| 2.7 | Untergrundband / Splitter | seitliches Einspeisen in Untergrundbänder möglich; Splitter mit Vorrang und Filter; Splitterspur 128 Positionen | kein Seiteneinspeisen, kein Vorrang/Filter, Spur 256 |
| 2.8 | Uferpumpe | 2×1 Felder | 1×1 |
| 2.9 | Strommast | 1 Holz + 2 Kupferkabel → 2 Masten; Holz aus Bäumen (groß 4, abgestorben 2), Start mit 1 Holz | Eisenstange statt Holz, Bäume ohne Holz |
| 2.10 | Forschung am Anfang (2.0) | Auslöser-Forschung: **Dampfkraft** (50 Eisenplatten herstellen → Rohr, Rohr unterirdisch, Uferpumpe, Kessel, Dampfmaschine), **Elektronik** (10 Kupferplatten → Kabel, Schaltkreis, Greifarm, Labor, Strommast), **Automatisierungs-Wissenschaft** (1 Labor herstellen → rotes Paket); **Elektrischer Bohrer** 25 × 10 s rot | alles von Anfang an frei |
| 2.11 | Logistik 2 | schaltet auch schnellen Splitter und schnelles Untergrundband (Lücke 6) frei | nur schnelles Band |
| 2.12 | Startausrüstung | 8 Eisenplatten, 1 Holz, Pistole, 10 Magazine, Brennstoff-Bohrer, Steinofen | ohne Holz, Pistole, Magazine |

## 3. Was im Basisspiel fehlt

Basisspiel laut Wiki: 245 Items/Gebäude und 161 Technologien. Eisenwerk: 31 Items und 4 Technologien.
Gruppiert in der Reihenfolge, in der man sie im Spiel braucht:

1. **Frühe Phase vervollständigen:** Holz und Bäume fällen, Holzkiste, Rohr unterirdisch, Pumpe, Lagertank,
   Stahlverarbeitung (Stahlplatte, Stahlkiste, Stahlofen), schneller Greifarm, Massengreifarm, mittlerer und großer
   Strommast, Umspannwerk, Lampe, Montagemaschine 2 und 3, schneller und Express-Splitter/-Untergrundband,
   Expressband, Landaufschüttung, Beton, Reparaturset, Radar, Mauer und Tor.
2. **Gegner und Verschmutzung** (der zentrale Druck im Original): Verschmutzung je Gebäude (z. B. Brennstoff-Bohrer
   12/min, elektrischer Bohrer 10/min, Kessel 30/min), Beißer und Nester, Evolution, Angriffe;
   Militär: Pistole, Maschinenpistole, Munition, Geschütz-, Laser- und Flammenwerfertürme, Rüstungen,
   Granaten, militärische Wissenschaft.
3. **Öl und Chemie:** Pumpjack, Ölraffinerie, Chemiefabrik, Kunststoff, Schwefel, Schwefelsäure, Batterie,
   festes Brennmaterial, Schmiermittel, Fortgeschrittener Schaltkreis, Motor, Elektromotor, Fässer,
   chemische (blaue) Wissenschaft.
4. **Strom erweitern:** Solarpanel, Akkumulator, Dampfturbine, Wärmetauscher, Kernreaktor, Uran (Zentrifuge,
   Brennstäbe, Kovarex).
5. **Transport:** Züge (Schienen, Lok, Güter- und Flüssigkeitswagen, Signale, Haltestellen), Auto, Panzer,
   Spidertron.
6. **Roboter und Logistiknetz:** Roboport, Bau- und Logistikroboter, Logistikkisten, persönliche Logistik.
7. **Schaltungsnetz:** roter/grüner Draht, Kombinatoren, Lautsprecher, Anzeige, Stromschalter.
8. **Module und Leuchtfeuer:** Geschwindigkeits-, Produktivitäts- und Effizienzmodule, Leuchtfeuer.
9. **Spielende:** Produktions-, Hightech- und Weltraum-Wissenschaft, Raketensilo, Satellit.
10. **Komfort/Mechaniken:** Blaupausen, Abriss- und Upgradeplaner, Produktionsstatistik, Strom-Statistik,
    Forschungswarteschlange, Greifarm-Kapazitätsbonus, Bergbau-Produktivität, Tag/Nacht, Klippen.

## 4. Umgesetzt (Blöcke 1–4, Stand 05.11.2026) und bewusste Vereinfachungen

| Bereich | Umgesetzt nach Wiki | Vereinfacht / fehlt noch |
|---|---|---|
| Öl und Chemie | Pumpjack (Ergiebigkeit, Erschöpfung), Raffinerie, Chemiefabrik, alle Grund-/Fortgeschrittene-Rezepte, Cracken, Kunststoff bis Batterie, Schmiermittel, Elektromotor, blaue Wissenschaft | Fässer, Kohleverflüssigung |
| Strom | Solarpanel 60 kW × Tageslicht, Akkumulator 5 MJ / 300 kW, Vorrang Solar > Dampf > Akku | Dampfturbine, Kernkraft |
| Komfort | Produktionsstatistik (1 min–10 h), Stromnetz-Statistik je Netz (Klick auf Mast), Forschungswarteschlange (7), Blaupausen (Strg+C/X/V, Bibliothek, Text) | Upgradeplaner, Blaupausenbücher; Bibliothek liegt im Browser |
| Module | 9 Module mit Wiki-Werten, Untergrenze 20 %, Produktivität nur bei Zwischenprodukten (Bonusbalken), Leuchtfeuer 1,5/√n im 9×9-Bereich | Qualität (Space Age) |
| Roboter | Hangar (50×50 / 110×110, 4 Ladeplätze à 500 kW, 2,1 MW Nachladung), Bau- und Logistikroboter (Tempo, Verbrauch, 20 % ohne Akku), 5 Logistikkisten, Vorrang aktiv > Lager/Puffer > passiv, Bauen von Geistern, Abriss | Reparatur, persönlicher Roboport, Laden unterwegs bei leerem Akku (Roboter fliegen langsam weiter), Frachtgrößen-Forschung |
| Schaltungsnetz | Rote/grüne Netze, Summen, Kiste/Tank/Akku als Sender, konstanter/Rechen-/Entscheidungskombinator (1 Tick Verzögerung, 32-Bit), Bedingungen für Greifarm, Lampe, Pumpe | Sonderzeichen Each/Everything/Anything, Auswahlkombinator, Band lesen/stoppen, Stromschalter, Anzeige |
| Züge | Fahrphysik je Tick (Gewicht, Luftwiderstand, Reibung, Bremskraft, Zugkraft 10, Höchsttempo 1,2, Brennstoffboni), Lok 600 kW, Güterwagen 40 Plätze, Bahnhöfe mit Namen, Fahrplan (Zeit, voll, leer, Inaktivität), Wegsuche, Greifarme an stehenden Wagen | Gleise nur gerade und 90°-Bögen (Radius 3) statt Rail-Planer mit Diagonalen; kein Rückwärtsfahren und kein Selbstfahren; jedes Gleisstück ist ein Block (Signale fehlen, Kollisionen werden trotzdem vermieden); Flüssigkeitswagen |
| Spielende | Raketensilo (100 Teile à 3 s, Module), Satellit, Fracht-Landeplatz, 1000 Weltraum-Pakete ~29 s nach dem Start, Sieg-Meldung, Produktions-/Hightech-/Weltraum-Wissenschaft, Technologien bis Raketensilo | Unendliche Forschungen |
| Gegner | Verschmutzung je Gebäude, Verteilung/Aufnahme je Abschnitt, Nester mit Verteidigern, Angriffswellen gegen Verschmutzer, Krabbler klein/mittel/groß mit Entwicklung, Hindernisse werden angegriffen, Friedensmodus, Geschützturm, Steinmauer, Magazine, Pistole/MP, Spielergesundheit, Reparaturset, Militär-Forschung | Speier und Würmer, Ausbreitung neuer Nester, Wegfindung (Gegner laufen direkt und weichen nur Wasser aus), Tor, Laser-/Flammentürme, Rüstungen, Granaten, militärische Wissenschaft, Leiche mit Inventar beim Tod |
| Fässer | 0,2 s, 50 Einheiten, alle Flüssigkeiten außer Dampf, Montagemaschine 2/3 | Nur zwei Sammelrezepte „Fass befüllen“/„Fass entleeren“ statt je Flüssigkeit eines (Maschine erkennt die Flüssigkeit; Wunsch 11.11.2026) |
| Weiter offen | – | Klippen, Auto/Panzer, Kernkraft, Dampfturbine, Signale/Diagonalen/Selbstfahren bei Zügen, Fässer, Sonderzeichen und weitere Kombinatoren, Upgradeplaner, persönlicher Roboport |
