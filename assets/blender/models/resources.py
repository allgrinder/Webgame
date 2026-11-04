"""Erzfelder: je Ressource 4 Varianten × 4 Dichtestufen, Brocken mit Schatten auf transparentem Grund."""
import eisen
import parts

RESOURCES = ('iron-ore', 'coal', 'stone')
COUNTS = (4, 7, 11, 16)
SIZES = (0.085, 0.095, 0.105, 0.11)


def render(out):
    for ri, res in enumerate(RESOURCES):
        for v in range(4):
            for d in range(4):
                eisen.reset(samples=40)
                parts.ore_pile(res, COUNTS[d], SIZES[d], seed=1000 * ri + 10 * v + d + 1, spread=0.36)
                eisen.shadow_catcher(4)
                eisen.camera(1, 1)
                name = f'res.{res}.{v}.{d}'
                out.add(name, 'terrain', [out.render_frame(name, 0)], (0.5, 0.5))
