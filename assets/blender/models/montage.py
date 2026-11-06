"""Montagemaschinen 1–3 im Stufenstil (Notbau, Werkstatt, Hochtechnik), je 16 Frames (30 Bilder/s). Geometrie: lib/stufen.py."""
import anlagen
import stufen


def render(out):
    for name, fn in (('assembling-machine-1', stufen.assembler1), ('assembling-machine-2', stufen.assembler2),
                     ('assembling-machine-3', stufen.assembler3)):
        anlagen.building(out, name, fn, (3.75, 4.5), (0.5, 2.6 / 4.5),
                         (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), frames=16, fps=30, samples=40)
