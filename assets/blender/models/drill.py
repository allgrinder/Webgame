"""Brennstoff-Bohrer: 4 Richtungen × 16 Frames Arbeitsanimation, Schatten je Richtung."""
import eisen
import stufe1
import parts

FRAMES = 16
CANVAS = (2.5, 3.25)
ANCHOR = (0.5, 2.0 / 3.25)
SH_CANVAS = (3.5, 3.5)
SH_ANCHOR = (1.25 / 3.5, 1.25 / 3.5)


def render(out):
    for d in range(4):
        frames = []
        for f in range(FRAMES):
            eisen.reset(samples=40)
            m = parts.Mats()
            root = stufe1.drill1(m, phase=f / FRAMES)
            eisen.rotate_root(root, d)
            eisen.camera(*CANVAS, anchor=ANCHOR)
            frames.append(out.render_frame(f'drill.{d}', f))
        out.add(f'drill.{d}', 'entities', frames, ANCHOR, fps=15)
        eisen.reset(samples=32)
        root = stufe1.drill1(None, 0)
        eisen.rotate_root(root, d)
        eisen.shadow_render(out, f'drill.{d}.shadow', 'entities', SH_CANVAS, SH_ANCHOR)
