"""Spielfigur: 4 Richtungen × 8 Lauf-Frames, mit Schatten im Bild."""
import math

import eisen
import parts

FRAMES = 8
CANVAS = (1.0, 1.25)
ANCHOR = (0.42, 0.82)
FACING = {0: math.pi, 1: math.pi / 2, 2: 0.0, 3: -math.pi / 2}


def render(out):
    for d in range(4):
        frames = []
        for f in range(FRAMES):
            eisen.reset(samples=40)
            root = parts.worker(parts.Mats(), phase=f / FRAMES)
            root.rotation_euler = (0, 0, FACING[d])
            eisen.shadow_catcher(4)
            eisen.camera(*CANVAS, anchor=ANCHOR)
            frames.append(out.render_frame(f'player.{d}', f))
        out.add(f'player.{d}', 'entities', frames, ANCHOR, fps=12)
