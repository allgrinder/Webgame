"""Eisenkiste (1×1) mit Schatten."""
import eisen
import parts

CANVAS = (1.25, 1.6)
ANCHOR = (0.5, 1.0 - 0.6 / 1.6)


def render(out):
    eisen.reset(samples=48)
    parts.iron_chest(parts.Mats())
    eisen.camera(*CANVAS, anchor=ANCHOR)
    out.add('iron-chest', 'entities', [out.render_frame('iron-chest', 0)], ANCHOR)
    eisen.reset(samples=32)
    parts.iron_chest(parts.Mats())
    eisen.shadow_render(out, 'iron-chest.shadow', 'entities', (1.75, 1.75), (0.3, 0.3))
