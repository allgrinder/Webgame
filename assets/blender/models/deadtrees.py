"""Abgestorbene Bäume (fällbar, 2 Holz): Gartenwerk-Baumgenerator ohne Laub, mit eigener Schattenebene."""
import math

import eisen
import gw_plants

TAN = math.tan(eisen.TILT)
DEAD = [
    # (Art, Krone, Höhe)
    ('quercus-rubra', 3.6, 6.0),
    ('acer-campestre', 3.2, 5.2),
    ('pinus-sylvestris', 2.8, 6.4),
    ('carpinus-betulus', 3.0, 5.0),
]


def canvas(d, h):
    w = d + 1.0
    top = d / 2 + h * TAN + 0.3
    bottom = d / 2 + 0.4
    cw, ch = math.ceil(w * 2) / 2, math.ceil((top + bottom) * 2) / 2
    return (cw, ch), ((d / 2 + 0.5) / cw, top / ch)


def render(out):
    for i, (sid, d, h) in enumerate(DEAD):
        eisen.reset(samples=48)
        sp = {'id': sid, 'kind': 'tree', 'diameterMature': d, 'heightMature': h}
        gw_plants.tree(sp, {'color': '#6b5a43', 'bare': True, 'bloom': None, 'fruit': None}, 1300 + i * 7)
        cv, anchor = canvas(d, h)
        eisen.camera(*cv, anchor=anchor)
        name = f'flora.deadtree.{i}'
        out.add(name, 'flora', [out.render_frame(name, 0)], anchor)
        sw = math.ceil((d + 1 + h * 0.6) * 2) / 2
        sh = math.ceil((d + 1 + h * 0.75) * 2) / 2
        eisen.shadow_render(out, f'{name}.shadow', 'flora', (sw, sh), ((d / 2 + 0.5) / sw, (d / 2 + 0.5) / sh), half=True)
