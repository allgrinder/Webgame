"""Brennstoff-Greifarm: Sockel und Arm. Der Arm wird mit der geneigten Spielkamera in 32 Winkeln
vorgerendert (Licht und Schatten stimmen in jeder Stellung); das Spiel wählt den nächsten Winkel.
Winkel k: Arm zeigt um k/32 Umdrehung im Uhrzeigersinn von Norden gedreht."""
import math

import bauten
import eisen
import parts

BASE_CANVAS = (1.0, 1.25)
BASE_ANCHOR = (0.5, 0.6)
ANGLES = 32
REACH = 1.1          # mittlere Reichweite (Aufnahme 1,0 / Ablage 1,2)
HAND_Z = 0.4         # Höhe von Drehpunkt und Hand
ARM_CANVAS = (2.75, 3.0)
ARM_ANCHOR = (0.5, 1.75 / 3.0)


# Varianten: Sprite-Präfix, Farbe von Ring und Arm, Reichweite (Mitte zwischen Aufnahme und Ablage), Brennkammer
VARIANTS = (
    ('inserter', None, REACH, True),
    ('inserter-electric', '#5d6a3a', REACH, False),
    ('inserter-long', '#6e3527', 2.1, False),
    ('inserter-fast', '#3f5d80', REACH, False),
)


def mats(paint):
    m = parts.Mats()
    if paint:
        m.ochre = bauten.weathered('ins_paint', paint, metal=0.3, rough=0.55, rust=0.4, dust=0.45, edge=0.7, streaks=0.5)
    return m


def render(out):
    for prefix, paint, reach, burner in VARIANTS:
        eisen.reset(samples=48)
        parts.inserter_base(mats(paint), burner)
        eisen.camera(*BASE_CANVAS, anchor=BASE_ANCHOR)
        out.add(f'{prefix}.base', 'entities', [out.render_frame(f'{prefix}.base', 0)], BASE_ANCHOR)

        canvas = ARM_CANVAS if reach < 1.5 else (5.0, 5.0)
        anchor = ARM_ANCHOR if reach < 1.5 else (0.5, 2.85 / 5.0)
        frames = []
        for k in range(ANGLES):
            eisen.reset(samples=32)
            root = parts.inserter_arm(mats(paint), reach)
            root.rotation_euler = (0, 0, -k / ANGLES * math.tau)
            eisen.camera(*canvas, anchor=anchor)
            frames.append(out.render_frame(f'{prefix}.arm', k))
        out.add(f'{prefix}.arm', 'entities', frames, anchor,
                meta={'angles': ANGLES, 'reach': reach, 'handLift': round(HAND_Z * math.tan(eisen.TILT), 4)})

        eisen.reset(samples=32)
        parts.inserter_base(mats(paint), burner)
        eisen.shadow_render(out, f'{prefix}.shadow', 'entities', (1.5, 1.5), (0.35, 0.35))
