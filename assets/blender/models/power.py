"""Strom: Uferpumpe, Kessel (mit Feuerschein), Dampfmaschine (Animation) und kleiner Strommast."""
import anlagen
import eisen

ALL = (0, 1, 2, 3)


def render(out):
    anlagen.building(out, 'offshore-pump', anlagen.offshore_pump, (2.5, 2.75), (0.5, 1.4 / 2.75),
                     (3.0, 3.0), (1.0 / 3.0, 1.0 / 3.0), dirs=ALL, frames=1)
    anlagen.building(out, 'boiler', lambda m, ph: anlagen.boiler(m, 0.15), (3.75, 4.25), (0.5, 2.4 / 4.25),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), dirs=ALL, frames=1, samples=48,
                     glow=((0.7, 1.0, 0.8, 0.95), anlagen.boiler))
    anlagen.building(out, 'steam-engine', anlagen.steam_engine, (5.75, 6.5), (0.5, 3.6 / 6.5),
                     (6.75, 6.75), (3.0 / 6.75, 3.0 / 6.75), dirs=ALL, frames=8, samples=36)
    anlagen.building(out, 'small-electric-pole', lambda m, ph: anlagen.small_pole(m), (1.25, 2.75), (0.5, 2.25 / 2.75),
                     (2.5, 2.5), (0.6 / 2.5, 0.6 / 2.5), frames=1, samples=40,
                     meta={'wireLift': round(anlagen.POLE_TOP * 0.5773, 4)})
