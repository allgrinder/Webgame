"""Untergrundband (Eingang/Ausgang je Richtung) und Splitter (4 Richtungen). Das Band darunter zeichnet das Bandsystem."""
import anlagen
import eisen

ALL = (0, 1, 2, 3)


def render(out):
    for kind in ('in', 'out'):
        for d in ALL:
            eisen.reset(samples=40)
            root = anlagen.underground(anlagen.Mats(), output=kind == 'out')
            eisen.rotate_root(root, d)
            canvas, anchor = (1.25, 1.75), (0.5, 1.0 / 1.75)
            eisen.camera(*canvas, anchor=anchor)
            name = f'underground-belt.{kind}.{d}'
            out.add(name, 'entities', [out.render_frame(name, 0)], anchor)
    anlagen.building(out, 'splitter', anlagen.splitter, (2.5, 3.0), (0.5, 1.75 / 3.0),
                     (3.0, 3.0), (1.0 / 3.0, 1.0 / 3.0), dirs=ALL, frames=1, samples=40)
