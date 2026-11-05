"""Labor (8 Frames Arbeitsanimation). Montagemaschinen: models/montage.py."""
import anlagen
import stufe1


def render(out):
    anlagen.building(out, 'lab', stufe1.lab1, (3.75, 4.5), (0.5, 2.6 / 4.5),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), frames=8, samples=40)
