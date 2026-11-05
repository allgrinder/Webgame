"""Rohr unterirdisch (4 Richtungen), Pumpe 1×2 (4 Richtungen, Animation) und Lagertank 3×3."""
import anlagen
import stufe23

ALL = (0, 1, 2, 3)


def render(out):
    anlagen.building(out, 'pipe-to-ground', lambda m, ph: anlagen.pipe_ground(m), (1.25, 1.5), (0.5, 0.8 / 1.5),
                     (1.75, 1.75), (0.6 / 1.75, 0.6 / 1.75), dirs=ALL, frames=1, samples=36)
    anlagen.building(out, 'pump', anlagen.fluid_pump, (2.5, 3.0), (0.5, 1.6 / 3.0),
                     (3.0, 3.0), (1.0 / 3.0, 1.0 / 3.0), dirs=ALL, frames=4, samples=36)
    anlagen.building(out, 'storage-tank', lambda m, ph: stufe23.storage_tank2(m), (4.0, 5.0), (0.5, 2.9 / 5.0),
                     (5.0, 5.0), (2.0 / 5.0, 2.0 / 5.0), dirs=ALL, frames=1, samples=40)
