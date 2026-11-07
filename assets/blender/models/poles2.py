"""Mittlerer und großer Strommast (mit Kabelhöhe im Manifest) und Lampe (mit Leuchtebene)."""
import math

import anlagen
import eisen
import kleinteile

TAN = math.tan(eisen.TILT)


def render(out):
    anlagen.building(out, 'medium-electric-pole', lambda m, ph: kleinteile.medium_pole(kleinteile.Mats('#5d6e78', level=2)), (1.5, 3.25), (0.5, 2.75 / 3.25),
                     (3.0, 3.0), (0.6 / 3.0, 0.6 / 3.0), frames=1, samples=40,
                     meta={'wireLift': round((anlagen.MEDIUM_TOP - 0.05) * TAN, 4)})
    anlagen.building(out, 'big-electric-pole', lambda m, ph: kleinteile.big_pole(kleinteile.Mats('#5d6e78', level=2)), (2.75, 4.75), (0.5, 3.75 / 4.75),
                     (4.5, 4.5), (1.0 / 4.5, 1.0 / 4.5), frames=1, samples=40,
                     meta={'wireLift': round((anlagen.BIG_TOP - 0.15) * TAN, 4)})
    anlagen.building(out, 'lamp', lambda m, ph: anlagen.lamp(m, 0.0), (1.0, 1.5), (0.5, 1.0 / 1.5),
                     (1.5, 1.5), (0.4 / 1.5, 0.4 / 1.5), frames=1, samples=40,
                     glow=((1.0,), lambda m, lv: anlagen.lamp(m, lv)))
