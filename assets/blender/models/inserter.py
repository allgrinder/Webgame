"""Brennstoff-Greifarm: Sockel (geneigte Kamera) und Arm (von oben, im Spiel drehbar), Schatten."""
import math

import eisen
import parts

BASE_CANVAS = (1.0, 1.25)
BASE_ANCHOR = (0.5, 0.6)
ARM_CANVAS = (0.375, 1.375)
ARM_ANCHOR = (0.5, 1.25 / 1.375)
# Höhe des Drehpunkts über dem Boden in Bildfeldern (für die Darstellung des Arms)
PIVOT_Z = 0.4


def render(out):
    eisen.reset(samples=48)
    parts.inserter_base(parts.Mats())
    eisen.camera(*BASE_CANVAS, anchor=BASE_ANCHOR)
    out.add('inserter.base', 'entities', [out.render_frame('inserter.base', 0)], BASE_ANCHOR,
            meta={'pivotLift': round(PIVOT_Z * math.tan(eisen.TILT), 4)})

    eisen.reset(samples=48)
    parts.inserter_arm(parts.Mats(), 1.0)
    eisen.camera(*ARM_CANVAS, anchor=ARM_ANCHOR, target=(0, 0, 0.4), tilt=0.0)
    out.add('inserter.arm', 'entities', [out.render_frame('inserter.arm', 0)], ARM_ANCHOR,
            meta={'reach': 1.05})

    eisen.reset(samples=32)
    parts.inserter_base(parts.Mats())
    eisen.shadow_render(out, 'inserter.shadow', 'entities', (1.5, 1.5), (0.35, 0.35))
