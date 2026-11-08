"""Brennstoff-Greifarm: Sockel und Arm. Der Arm wird mit der geneigten Spielkamera in 32 Winkeln
vorgerendert (Licht und Schatten stimmen in jeder Stellung); das Spiel wählt den nächsten Winkel.
Winkel k: Arm zeigt um k/32 Umdrehung im Uhrzeigersinn von Norden gedreht."""
import math

import eisen
import kleinteile

BASE_CANVAS = (1.0, 1.25)
BASE_ANCHOR = (0.5, 0.6)
ANGLES = 32
REACH = 1.1          # mittlere Reichweite (Aufnahme 1,0 / Ablage 1,2)
HAND_Z = 0.4         # Höhe von Drehpunkt und Hand
ARM_CANVAS = (2.75, 3.0)
ARM_ANCHOR = (0.5, 1.75 / 3.0)


# Varianten: Sprite-Präfix, Farbe von Ring und Arm, Reichweite (Mitte zwischen Aufnahme und Ablage), Brennkammer
VARIANTS = (
    ('inserter', '#5e5548', REACH, True),
    ('inserter-electric', '#b08a2a', REACH, False),
    ('inserter-long', '#6e3527', 2.1, False),
    ('inserter-fast', '#3f5d80', REACH, False),
    ('inserter-bulk', '#4f7a3a', REACH, False),
)


def mats(paint):
    return kleinteile.Mats(paint, level=1 if paint == '#5e5548' else 2)


def render(out):
    for prefix, paint, reach, burner in VARIANTS:
        eisen.reset(samples=48)
        kleinteile.inserter_base(mats(paint), burner)
        eisen.camera(*BASE_CANVAS, anchor=BASE_ANCHOR)
        out.add(f'{prefix}.base', 'entities', [out.render_frame(f'{prefix}.base', 0)], BASE_ANCHOR)

        canvas = ARM_CANVAS if reach < 1.5 else (5.0, 5.0)
        anchor = ARM_ANCHOR if reach < 1.5 else (0.5, 2.85 / 5.0)
        frames = []
        for k in range(ANGLES):
            eisen.reset(samples=32)
            root = kleinteile.inserter_arm(mats(paint), reach)
            root.rotation_euler = (0, 0, -k / ANGLES * math.tau)
            eisen.camera(*canvas, anchor=anchor)
            frames.append(out.render_frame(f'{prefix}.arm', k))
        out.add(f'{prefix}.arm', 'entities', frames, anchor,
                meta={'angles': ANGLES, 'reach': reach, 'handLift': round(HAND_Z * math.tan(eisen.TILT), 4)})

        eisen.reset(samples=32)
        kleinteile.inserter_base(mats(paint), burner)
        eisen.shadow_render(out, f'{prefix}.shadow', 'entities', (1.5, 1.5), (0.35, 0.35))
