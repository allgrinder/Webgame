"""Brennstoff-Greifarm: Sockel und Arm. Der Arm wird mit der geneigten Spielkamera in 32 Winkeln
vorgerendert (Licht und Schatten stimmen in jeder Stellung); das Spiel wählt den nächsten Winkel.
Winkel k: Arm zeigt um k/32 Umdrehung im Uhrzeigersinn von Norden gedreht."""
import math

import eisen
import parts

BASE_CANVAS = (1.0, 1.25)
BASE_ANCHOR = (0.5, 0.6)
ANGLES = 32
REACH = 1.1          # mittlere Reichweite (Aufnahme 1,0 / Ablage 1,2)
HAND_Z = 0.4         # Höhe von Drehpunkt und Hand
ARM_CANVAS = (2.75, 3.0)
ARM_ANCHOR = (0.5, 1.75 / 3.0)


def render(out):
    eisen.reset(samples=48)
    parts.inserter_base(parts.Mats())
    eisen.camera(*BASE_CANVAS, anchor=BASE_ANCHOR)
    out.add('inserter.base', 'entities', [out.render_frame('inserter.base', 0)], BASE_ANCHOR)

    frames = []
    for k in range(ANGLES):
        eisen.reset(samples=32)
        root = parts.inserter_arm(parts.Mats(), REACH)
        root.rotation_euler = (0, 0, -k / ANGLES * math.tau)
        eisen.camera(*ARM_CANVAS, anchor=ARM_ANCHOR)
        frames.append(out.render_frame('inserter.arm', k))
    out.add('inserter.arm', 'entities', frames, ARM_ANCHOR,
            meta={'angles': ANGLES, 'reach': REACH, 'handLift': round(HAND_Z * math.tan(eisen.TILT), 4)})

    eisen.reset(samples=32)
    parts.inserter_base(parts.Mats())
    eisen.shadow_render(out, 'inserter.shadow', 'entities', (1.5, 1.5), (0.35, 0.35))
