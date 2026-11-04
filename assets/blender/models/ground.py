"""Boden: trockene Steppenwiese als periodische Fläche von 16×16 Feldern (1 Feld = 1 m).

Aufbau nach dem Wiesengenerator aus Gartenwerk (gw_ground.meadow): einzelne Grashalme in Büscheln,
dazwischen offene Erde mit Kieseln und wenigen, gedeckten Blüten. Alles ist periodisch:
Halme und Kiesel werden um ±16 m dupliziert, Farben laufen über einen 4D-Torus, die Halmdichte
über Sinusfunktionen mit ganzzahliger Frequenz. Ein einziger Renderlauf (1024×1024) wird in
256 Kacheln geschnitten (ground.X.Y für Spielposition x mod 16, y mod 16).
"""
import math
import random

import bmesh
import bpy
import eisen
import gw_ground
import gw_lib
import gw_plants
import seamless
from mathutils import Euler, Vector

T = 16
P = gw_lib.P


def density(x, y, ph):
    """Periodische Halmdichte 0..1 (Periode T in x und y)."""
    k = 2 * math.pi / T
    d = (0.58
         + 0.22 * math.sin(k * 2 * x + ph[0]) * math.sin(k * 1 * y + ph[1])
         + 0.18 * math.sin(k * (3 * x + 2 * y) + ph[2])
         + 0.14 * math.sin(k * (x - 4 * y) + ph[3])
         + 0.10 * math.sin(k * (5 * x - 3 * y) + ph[4]))
    return min(1.0, max(0.0, d))


def base_material():
    """Erde mit olivgrünen und trockenen Flecken, periodisch über den Torus."""
    m, b = gw_lib._principled('steppe_base')
    nt = m.node_tree
    n = nt.nodes
    L = nt.links
    big = seamless.noise4(nt, 1.2, (2.0, 0.5, 1.5, 3.1), detail=4, roughness=0.55, scale=1.3, period=T)
    fine = seamless.noise4(nt, 9.0, (0.3, 1.1, 2.7, 0.9), detail=6, roughness=0.6, scale=1.4, period=T)
    ramp = n.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.elements[0].position = 0.32
    cr.elements[0].color = (*gw_ground.lin('#4f4130'), 1)
    cr.elements[1].position = 0.7
    cr.elements[1].color = (*gw_ground.lin('#5b5733'), 1)
    mid = cr.elements.new(0.5)
    mid.color = (*gw_ground.lin('#66553b'), 1)
    L.new(big.outputs['Fac'], ramp.inputs['Fac'])
    mix = n.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'OVERLAY'
    mix.inputs['Factor'].default_value = 0.45
    L.new(ramp.outputs['Color'], mix.inputs[6])
    L.new(fine.outputs['Color'], mix.inputs[7])
    L.new(mix.outputs[2], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 1.0
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.5
    bump.inputs['Distance'].default_value = 0.02
    L.new(fine.outputs['Fac'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    gw_lib._ao(m, 0.7, 0.05)
    return m


def blades(rnd, ph):
    tones = ['#a89a5e', '#b7a96d', '#8f8c4c', '#7c8243', '#6d7840', '#c2b57f', '#9c8f55', '#83793f']
    mats = [gw_ground.pmat(f'st{i}', gw_ground.lin(h), 0.65, 0.12, 0.0, 10, 0.3, 0.6) for i, h in enumerate(tones)]
    bm = bmesh.new()
    tufts = []
    while len(tufts) < 7000:
        x, y = rnd.uniform(0, T), rnd.uniform(0, T)
        if rnd.random() < density(x, y, ph) ** 1.4:
            tufts.append((x, y, rnd.uniform(0.05, 0.15), rnd.uniform(0.6, 1.3)))
    count = 0
    target = 300000
    while count < target:
        if rnd.random() < 0.85:
            tx, ty, tr, th = tufts[count % len(tufts)]
        else:
            tx, ty, tr, th = rnd.uniform(0, T), rnd.uniform(0, T), 0.0, 0.6
            if rnd.random() > density(tx, ty, ph):
                count += 1
                continue
        rr = abs(rnd.gauss(0, tr))
        aa = rnd.uniform(0, 6.283)
        x, y = (tx + math.cos(aa) * rr) % T, (ty + math.sin(aa) * rr) % T
        L = rnd.uniform(0.08, 0.26) * th
        gw_ground.blade(bm, x, y, 0.0, L, aa + rnd.uniform(-0.6, 0.6), rnd.uniform(0.3, 0.8), 0.006, count % len(mats))
        count += 1
    gw_ground.periodic_mesh('blades', bm, mats, (T, T))


def flowers(rnd):
    kinds = [('#e6e0cc', 0.018, 'ball', 160), ('#d4b247', 0.016, 'saucer', 90), ('#8d6f9a', 0.012, 'ball', 70)]
    for hex_, size, kind, n in kinds:
        proto = gw_plants.flower_obj(hex_, size, kind)
        centers = [(rnd.uniform(0, T), rnd.uniform(0, T)) for _ in range(max(3, n // 15))]
        for _ in range(n):
            cx, cy = rnd.choice(centers)
            px, py = (cx + rnd.gauss(0, 0.35)) % T, (cy + rnd.gauss(0, 0.35)) % T
            o = bpy.data.objects.new('fl', proto.data)
            o.scale = (rnd.uniform(1.0, 1.6),) * 3
            o.location = P(px, py, rnd.uniform(0.1, 0.25))
            o.rotation_euler = Euler((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6)))
            gw_lib.link(o, outline=False)
            gw_ground.tiled(o, (T, T), size * 2)


def render(out):
    eisen.reset(samples=40, ground=False)
    rnd = random.Random(16)
    ph = [rnd.uniform(0, 6.283) for _ in range(5)]
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=T / 2 + 1.5)
    plane = eisen.mesh_obj('base', bm, base_material())
    plane.location = (T / 2, -T / 2, 0)
    # Rasterlage: Ebene um den Ursprung, Objektkoordinaten = Weltkoordinaten
    mats = [gw_ground.pmat(f'pb{i}', gw_ground.lin(h), 0.9, 0.2, 0.3, 30) for i, h in enumerate(['#6e604a', '#857660', '#5a4c3a', '#9a8c72'])]
    gw_ground.scatter_pebbles((T, T), 2600, 0.008, 0.028, mats, rnd, 0.55)
    blades(rnd, ph)
    flowers(rnd)
    eisen.camera(T, T, target=tuple(P(T / 2, T / 2, 0)))
    sheet = out.frame_path('ground.sheet', 0)
    eisen.render_to(sheet)
    out.add_sheet(sheet, T, T, 'ground.{x}.{y}', 'terrain')
