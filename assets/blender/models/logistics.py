"""Untergrundband (Eingang/Ausgang je Richtung) und Splitter (4 Richtungen). Das Band darunter zeichnet das Bandsystem."""
import anlagen
import eisen

ALL = (0, 1, 2, 3)


# Stufen: Name des Untergrundbands, des Splitters, Anstrich (None = Standard)
TIERS = (('underground-belt', 'splitter', None), ('fast-underground-belt', 'fast-splitter', '#7a3a28'))


def mats(color):
    m = anlagen.Mats()
    if color:
        m.paint = anlagen.paint(color, 'a_fastpaint')
    return m


def render(out):
    for ug, sp, color in TIERS:
        for kind in ('in', 'out'):
            for d in ALL:
                eisen.reset(samples=40)
                root = anlagen.underground(mats(color), output=kind == 'out')
                eisen.rotate_root(root, d)
                canvas, anchor = (1.25, 1.75), (0.5, 1.0 / 1.75)
                eisen.camera(*canvas, anchor=anchor)
                name = f'{ug}.{kind}.{d}'
                out.add(name, 'entities', [out.render_frame(name, 0)], anchor)
        anlagen.building(out, sp, lambda m, ph, c=color: anlagen.splitter(mats(c), ph), (2.5, 3.0), (0.5, 1.75 / 3.0),
                         (3.0, 3.0), (1.0 / 3.0, 1.0 / 3.0), dirs=ALL, frames=1, samples=40)
