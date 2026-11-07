"""Rohr: 16 Anschlussvarianten (Maske N=1, O=2, S=4, W=8), wie im Spiel aus den Verbindungen gewählt."""
import eisen
import kleinteile

CANVAS = (1.25, 1.5)
ANCHOR = (0.5, 0.8 / 1.5)


def render(out):
    for mask in range(16):
        eisen.reset(samples=32)
        kleinteile.pipe_piece(kleinteile.Mats(), mask)
        eisen.camera(*CANVAS, anchor=ANCHOR)
        name = f'pipe.{mask}'
        out.add(name, 'entities', [out.render_frame(name, 0)], ANCHOR)
