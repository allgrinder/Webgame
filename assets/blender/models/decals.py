"""Bodendecals (flach, über dem Boden, unter Gebäuden): Erd- und Kiesflecken mit weichem Rand,
Kieselgruppen, Blütengruppen, Grasbüschel, großflächige Farbflächen gegen sichtbare Wiederholung.
Mit Schattenfänger (Schatten im Bild). Bausteine: lib/natur.py, Gartenwerk (gw_ground, gw_plants).
"""
import math
import random

import bmesh
import bpy
import eisen
import gw_ground
import gw_lib
import gw_plants
from mathutils import Euler
from natur import disc, patch_material, pebbles, rim_blades

P = gw_lib.P
lin = gw_ground.lin


def finish(out, name, size):
    eisen.shadow_catcher(size * 3)
    eisen.camera(size, size)
    out.add(name, 'decals', [out.render_frame(name, 0)], (0.5, 0.5))


def render(out):
    # Erdflecken (offener Boden) und Kiesflecken, zwei Größen
    patches = [
        ('dirt', 1.5, ('#5a4632', '#6e5a40'), ('#6e604a', '#857660', '#5a4c3a'), 260),
        ('dirt', 2.4, ('#57442f', '#6b583f'), ('#6e604a', '#857660', '#5a4c3a'), 520),
        ('gravel', 1.4, ('#5c5446', '#6a6150'), ('#7d7465', '#6a6254', '#8a8070', '#5c554a'), 900),
        ('gravel', 2.2, ('#5a5244', '#68604f'), ('#7d7465', '#6a6254', '#8a8070', '#5c554a'), 1800),
    ]
    k = 0
    for kind, R, base, ptones, n in patches:
        for v in range(2):
            eisen.reset(samples=40, ground=False)
            rnd = random.Random(100 + k * 7 + v)
            disc(R, patch_material(f'pt{k}{v}', base, k * 2 + v))
            if kind == 'dirt':
                pebbles(n, R * 0.75, rnd, ptones, 0.008, 0.03)
            else:
                pebbles(n, R * 0.8, rnd, ptones, 0.012, 0.035, angular=True)
            rim_blades(R * 0.55, R * 1.05, int(900 * R), rnd)
            size = math.ceil(R * 2 * 1.45 + 0.4)
            finish(out, f'decal.{kind}.{k % 2 * 2 + v}', size)
        k += 1

    # Großflächige Farbflächen (gegen sichtbare Wiederholung der Bodenkacheln), Viertelauflösung, im Spiel ×4
    tints = [('#a89a62', '#b8a873'), ('#5d6a3a', '#6a7744'), ('#6b563e', '#7a6447'), ('#8f8a55', '#9d9660')]
    for v, tones in enumerate(tints):
        eisen.reset(samples=16, ground=False)
        disc(5.0, patch_material(f'tint{v}', tones, 50 + v, noise_amp=0.5, opacity=0.32, bump=0.0))
        eisen.camera(14, 14)
        bpy.context.scene.render.resolution_percentage = 25
        name = f'decal.tint.{v}'
        out.add(name, 'decals', [out.render_frame(name, 0)], (0.5, 0.5), meta={'scale': 4})

    # Kieselgruppen
    for v in range(6):
        eisen.reset(samples=40, ground=False)
        rnd = random.Random(300 + v)
        tones = ['#8a8070', '#9c9384', '#6f675a', '#a89e8c'] if v % 2 == 0 else ['#77706a', '#5f5a55', '#8b847c']
        pebbles(rnd.randint(4, 9), 0.32, rnd, tones, 0.03, 0.075, angular=v % 3 == 0, flat=0.6)
        finish(out, f'decal.pebbles.{v}', 1)

    # Blütengruppen (gedeckt)
    flowers = [('#e6e0cc', 0.02, 'daisy'), ('#d4b247', 0.018, 'saucer'), ('#8d6f9a', 0.014, 'ball'), ('#e9e4d2', 0.016, 'ball')]
    for v, (hex_, size, kind) in enumerate(flowers):
        eisen.reset(samples=40, ground=False)
        rnd = random.Random(400 + v)
        proto = gw_plants.flower_obj(hex_, size, kind)
        stem = gw_ground.pmat('stem', lin('#6b7442'), 0.7, 0.1, 0.0, 10, 0.3, 0.5)
        bm = bmesh.new()
        for i in range(rnd.randint(14, 24)):
            a = rnd.uniform(0, math.tau)
            r = 0.3 * math.sqrt(rnd.random())
            x, y = math.cos(a) * r, math.sin(a) * r
            h = rnd.uniform(0.12, 0.3)
            o = bpy.data.objects.new('fl', proto.data)
            o.scale = (rnd.uniform(1.0, 1.5),) * 3
            o.location = P(x, y, h)
            o.rotation_euler = Euler((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6)))
            gw_lib.link(o, outline=False)
            gw_ground.blade(bm, x, y, 0.0, h, 0, 0.05, 0.004, 0)
        me = bpy.data.meshes.new('stems')
        bm.to_mesh(me)
        bm.free()
        so = gw_lib.link(bpy.data.objects.new('stems', me), outline=False)
        so.data.materials.append(stem)
        rim_blades(0.0, 0.38, 260, rnd)
        finish(out, f'decal.flowers.{v}', 1)

    # Grasbüschel (trocken, höher)
    for v in range(6):
        eisen.reset(samples=40, ground=False)
        sp = {'id': ['stipa', 'carex', 'pennisetum'][v % 3], 'kind': 'grass', 'diameterMature': 0.55 + 0.1 * (v % 2), 'heightMature': 0.4 + 0.08 * (v % 3)}
        look = {'color': ['#a39859', '#8a8a4c', '#b3a56c'][v % 3], 'bare': False, 'bloom': None, 'fruit': None}
        gw_plants.grass(sp, look, 500 + v)
        finish(out, f'decal.tuft.{v}', 1)
