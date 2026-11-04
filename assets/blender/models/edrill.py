"""Elektrischer Bohrer 3×3: 4 Richtungen × 8 Frames (Bohrkopf dreht), Schatten je Richtung."""
import anlagen


def render(out):
    anlagen.building(out, 'electric-mining-drill', anlagen.electric_drill, (4.25, 5.0), (0.5, 3.0 / 5.0),
                     (5.0, 5.0), (2.0 / 5.0, 2.0 / 5.0), dirs=(0, 1, 2, 3), frames=8, samples=36)
