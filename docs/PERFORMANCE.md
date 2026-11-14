# Leistung (Skill performance-optimization)

Vorgehen: Budget festlegen, in ms messen (Durchschnitt und p95), den größten Posten finden, ändern, gleich messen.

## Messszene
`?scene=factory` (`src/game/factoryscene.ts`, fester Seed 777): 5.569 Gebäude – 2 Dampfblöcke 1:20:40, 6 Solarkacheln,
8 Bohrerfelder (240 Bohrer), 6 Ofenreihen (288 Öfen), 2 Malls, 60 Zahnrad-Montagemaschinen, 20 Labore, 3.014 Bandfelder
mit 8.320 Items, 804 Greifarme, Umspannwerk-Raster. F3 zeigt Bild/Simulation/Zeichnen/Oberfläche als Ø/p95 in ms.

## Budgets
| Teil | Budget | Prüfung |
|---|---|---|
| Simulation je Takt (Großfabrik) | p95 < 8 ms (Ziel ≤ 1/3 von 16,7 ms) | `tests/sim/bench.test.ts` |
| Simulation je Takt im Browser | p95 < 12 ms (Software-Grafik im Container) | `e2e/perf.spec.ts` |

## Messungen (14.11.2026, Container ohne Grafikkarte, Chromium mit SwiftShader)
- Simulation headless: Ø 2,1 ms, p95 3,1 ms je Takt.
- Browser, Übersicht (Zoom 0,35): Hauptthread ~83 % untätig → **grafikgebunden** (Füllrate), nicht JavaScript.
  CPU je Bild ~20 ms (davon Zeichnen ~8 ms, Simulation ~9 ms bei mehreren Takten je Bild).
- Bilder/s, je dreimal: Standard 3,2 / 3,2 / 2,3 – halbe Auflösung (`?pixel=0.5`) 5,2 / 6,3 / 6,6 → etwa doppelt so schnell.
  Ohne Farbabstimmung (`?look=0`) 6,7, ohne Leuchteffekte 5,3 (Einzelmessung).

## Umgesetzt
- Filterfläche = sichtbarer Ausschnitt (`filterArea`): keine Grenzberechnung über alle Sprites je Bild.
- Einstellung „Auflösung“ (automatisch / 1× / 0,75× / 0,5×, Menü oder `?pixel=`), wirkt sofort.
- Hinweis nach 20 s unter 25 Bildern/s: Auflösung senken oder Leuchteffekte aus.

## Offen / nächste Kandidaten
- Zwei Vollbild-Farbfilter (Boden + Welt) zu einem zusammenfassen (z. B. Bodenabstimmung in die Texturen backen).
- Auf echter Hardware messen (Grafikkarte, hochauflösender Bildschirm) – die Zahlen hier sind nur relativ vergleichbar.
