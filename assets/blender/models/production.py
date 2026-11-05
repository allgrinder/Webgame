"""Montagemaschine und Labor (je 8 Frames Arbeitsanimation)."""
import anlagen


def assembler2(m, phase):
    """Montagemaschine 2: blaugraues Dach statt grün."""
    m.green = anlagen.paint('#4b5f73', 'a_am2')
    return anlagen.assembler(m, phase)


def render(out):
    anlagen.building(out, 'assembling-machine-1', anlagen.assembler, (3.75, 4.5), (0.5, 2.6 / 4.5),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), frames=8, samples=40)
    anlagen.building(out, 'assembling-machine-2', assembler2, (3.75, 4.5), (0.5, 2.6 / 4.5),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), frames=8, samples=40)
    anlagen.building(out, 'lab', anlagen.lab, (3.75, 4.5), (0.5, 2.6 / 4.5),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), frames=8, samples=40)
