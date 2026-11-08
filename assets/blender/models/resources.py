"""Erzfelder: je Ressource 6 Varianten × 4 Dichtestufen.

Jede Kachel ist 1,5 × 1,5 Felder groß (96 px) und überlappt ihre Nachbarn: dunkler, weich
auslaufender Erdgrund und Brocken bis über den Feldrand. So entsteht ein zusammenhängendes Feld
statt eines Rasters. Brocken mit Gartenwerk-Kieselformen (gw_ground.pebble_mesh), Schatten im Bild.
"""
import math
import random

import bpy
import eisen
import gw_ground
import gw_lib
from mathutils import Euler
from natur import disc, patch_material

P = gw_lib.P
lin = gw_ground.lin
RESOURCES = ('iron-ore', 'coal', 'stone', 'copper-ore', 'uranium-ore')
COUNTS = (5, 9, 14, 20)
SIZE = 1.5

STYLE = {
    # Gesteinstöne, Grund (zwei Töne), Kantigkeit, Größe
    'iron-ore': (['#6b737a', '#7c858b', '#5d6369', '#7a5a46', '#8a6a52'], ('#3f3428', '#4b3d2e'), True, (0.06, 0.13)),
    'coal': (['#232324', '#2c2c2e', '#1a1a1b', '#333234'], ('#2c2620', '#35302a'), True, (0.06, 0.12)),
    'stone': (['#a39479', '#b3a58a', '#8f826b', '#9c8d74'], ('#5a4c3a', '#665643'), False, (0.06, 0.13)),
    # Kupfererz: rotbraune Brocken mit grünlicher Patina (Malachit)
    'copper-ore': (['#9c5a34', '#b06a3e', '#7f4a2c', '#5f7d64', '#8c5333'], ('#3f3226', '#4c3a2a'), True, (0.06, 0.13)),
    # Uranerz: dunkles Gestein mit giftgrünen Einschlüssen
    'uranium-ore': (['#3c4a32', '#4f6a3a', '#6cc23a', '#2f3a2a', '#5aa034'], ('#2f3324', '#373c2a'), True, (0.06, 0.13)),
}


def render(out):
    for ri, res in enumerate(RESOURCES):
        tones, ground, angular, (rmin, rmax) = STYLE[res]
        for v in range(6):
            for d in range(4):
                eisen.reset(samples=40, ground=False)
                rnd = random.Random(1000 * ri + 17 * v + d + 1)
                # Erdgrund: wird mit der Dichte deckender
                # weicher, unregelmäßiger Rand; dünne Stufen lassen die Wiese durchscheinen (keine Kreisflecken)
                m = patch_material(f'og{ri}{v}{d}', ground, v * 4 + d, noise_amp=0.48, opacity=0.5 + 0.13 * d, bump_strength=0.4)
                disc(0.7 + 0.04 * d, m)
                mats = [gw_ground.pmat(f'or{i}', lin(h), 0.6 if res == 'coal' else 0.8, 0.25, 0.5, 25, 0.5 if res == 'coal' else 0.3)
                        for i, h in enumerate(tones)]
                meshes = [gw_ground.pebble_mesh(f'om{i}', 1.0, rnd, 0.55, 1 if angular else 2, not angular, 0.25 if angular else 0.05)
                          for i in range(8)]
                n = COUNTS[d]
                placed = []
                tries = 0
                while len(placed) < n and tries < 600:
                    tries += 1
                    r = rnd.uniform(rmin, rmax) * (0.85 + 0.1 * d)
                    a = rnd.uniform(0, math.tau)
                    dist = 0.55 * math.sqrt(rnd.random())
                    x, y = math.cos(a) * dist, math.sin(a) * dist
                    if any((x - px) ** 2 + (y - py) ** 2 < (r + pr) ** 2 * 0.6 for px, py, pr in placed):
                        continue
                    placed.append((x, y, r))
                for i, (x, y, r) in enumerate(placed):
                    ob = bpy.data.objects.new('ore', meshes[i % len(meshes)])
                    ob.scale = (r, r * rnd.uniform(0.75, 1.1), r)
                    ob.location = P(x, y, r * 0.55 * 0.35)
                    ob.rotation_euler = Euler((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6.28)))
                    gw_lib.link(ob, outline=False)
                    if not ob.data.materials:
                        ob.data.materials.append(mats[0])
                    ob.material_slots[0].link = 'OBJECT'
                    ob.material_slots[0].material = mats[i % len(mats)]
                eisen.shadow_catcher(6)
                eisen.camera(SIZE, SIZE)
                name = f'res.{res}.{v}.{d}'
                out.add(name, 'terrain', [out.render_frame(name, 0)], (0.5, 0.5))
