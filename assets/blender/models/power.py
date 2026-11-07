"""Strom: Uferpumpe, Kessel (mit Feuerschein), Dampfmaschine (Animation) und kleiner Strommast."""
import anlagen
import eisen
import kleinteile
import stufe1

ALL = (0, 1, 2, 3)


def pump_1x2(m, phase):
    """Uferpumpe auf 1×2 Feldern: Ursprung in der Mitte zwischen Landfeld (Norden) und Wasserfeld (Süden)."""
    root = stufe1.offshore_pump1(m, phase)
    for c in root.children:
        c.location.y += 0.5
    return root


def render(out):
    anlagen.building(out, 'offshore-pump', pump_1x2, (2.5, 2.75), (0.5, 1.4 / 2.75),
                     (3.0, 3.0), (1.0 / 3.0, 1.0 / 3.0), dirs=ALL, frames=1)
    anlagen.building(out, 'boiler', lambda m, ph: stufe1.boiler1(m, 0.15), (3.75, 4.25), (0.5, 2.4 / 4.25),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), dirs=ALL, frames=1, samples=48,
                     glow=((0.7, 1.0, 0.8, 0.95), stufe1.boiler1))
    anlagen.building(out, 'steam-engine', stufe1.steam_engine1, (5.75, 6.5), (0.5, 3.6 / 6.5),
                     (6.75, 6.75), (3.0 / 6.75, 3.0 / 6.75), dirs=ALL, frames=8, samples=36)
    anlagen.building(out, 'small-electric-pole', lambda m, ph: kleinteile.small_pole(kleinteile.Mats()), (1.25, 2.75), (0.5, 2.25 / 2.75),
                     (2.5, 2.5), (0.6 / 2.5, 0.6 / 2.5), frames=1, samples=40,
                     meta={'wireLift': round(anlagen.POLE_TOP * 0.5773, 4)})
