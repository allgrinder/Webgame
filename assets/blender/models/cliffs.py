"""Klippen: geschichtete Felsstufen aus flachen Gesteinsplatten (Schichtung zur Kamera hin abgetreppt),
Geröll am Fuß und einzelne Grasbüschel. Acht Varianten; im Spiel liegt je Klippenfeld eine Variante,
die sich mit den Nachbarn überlappt, sodass durchgehende Felskanten entstehen. Mit Schattenebene."""
import math
import random

import bmesh
import bpy
import eisen
import gw_ground
import gw_lib

lin = gw_ground.lin
VARIANTS = 8
CANVAS = (2.5, 2.75)
ANCHOR = (0.5, 1.55 / 2.75)
TONES = ('#5a4d3e', '#64564a', '#4c4136', '#6d5f4e', '#453b31')


def slab(name, rx, ry, h, loc, mat, rnd, rot):
    """Flache, kantige Gesteinsplatte (verformte Ikosphäre, oben fast eben)."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
    for v in bm.verts:
        n = 1 + (rnd.random() - 0.5) * 0.35
        v.co.x *= rx * n
        v.co.y *= ry * n
        v.co.z = max(-0.6, min(0.75, v.co.z)) * h * (1 + (rnd.random() - 0.5) * 0.2)
    o = eisen.mesh_obj(name, bm, mat, smooth=False)
    o.location = loc
    o.rotation_euler = (rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05), rot)
    return o


def cliff(seed):
    rnd = random.Random(seed)
    mats = [gw_ground.pmat(f'cl{seed}{i}', lin(t), 0.92, 0.45, 0.9, 7 + i, spec=0.15) for i, t in enumerate(TONES)]
    face = gw_ground.pmat(f'clf{seed}', lin('#2f2821'), 0.95, 0.4, 0.9, 11, spec=0.1)
    o = []
    rot = rnd.uniform(-0.4, 0.4)
    # Flache Felsbank: wenige breite Schichten, nach oben schmaler und nach Norden versetzt (Stufe zeigt nach Süden)
    layers = 3
    for k in range(layers):
        t = k / layers
        rx = 0.98 - 0.25 * t + rnd.uniform(-0.05, 0.05)
        ry = 0.78 - 0.25 * t + rnd.uniform(-0.04, 0.04)
        z = 0.05 + k * 0.11
        y = 0.04 + t * 0.22
        for j in range(3):
            ox = rnd.uniform(-0.35, 0.35)
            o.append(slab(f's{k}{j}', rx * rnd.uniform(0.55, 0.75), ry * rnd.uniform(0.65, 0.95), 0.08 + rnd.uniform(0, 0.04),
                          (ox, y + rnd.uniform(-0.08, 0.08), z), mats[(k + j + seed) % len(mats)], rnd, rot + rnd.uniform(-0.4, 0.4)))
    # dunkle, zerklüftete Felswand auf der Südseite (Stufe), aus mehreren hohen, schmalen Brocken
    for i in range(5):
        x = -0.75 + i * 0.37 + rnd.uniform(-0.06, 0.06)
        h = rnd.uniform(0.22, 0.32)
        o.append(slab(f'face{i}', 0.24, 0.12, h, (x, -0.28 + rnd.uniform(-0.05, 0.05), h * 0.55), face, rnd, rot + rnd.uniform(-0.3, 0.3)))
    # einzelne große Blöcke an der Kante
    for i in range(2):
        a = rnd.uniform(-math.pi * 0.8, -math.pi * 0.2)
        s_ = rnd.uniform(0.16, 0.24)
        o.append(eisen.rock(f'blk{i}', s_, (math.cos(a) * 0.55, math.sin(a) * 0.45, s_ * 0.45), mats[(i + 2) % len(mats)], seed * 17 + i, squash=0.6))
    # Geröll am Fuß (Süden) und an den Seiten
    for i in range(7):
        a = rnd.uniform(-math.pi * 0.95, -math.pi * 0.05)
        r = rnd.uniform(0.55, 0.85)
        s = rnd.uniform(0.06, 0.16)
        o.append(eisen.rock(f'deb{i}', s, (math.cos(a) * r, math.sin(a) * r * 0.8, s * 0.3), mats[i % len(mats)], seed * 31 + i, squash=0.55))
    root = eisen.parent_all(o, 'cliff')
    # Grasbüschel am Fuß, wie bei den Felsgruppen
    bm = bmesh.new()
    for k in range(500):
        a = rnd.uniform(-math.pi, math.pi)
        rr = rnd.uniform(0.7, 1.05)
        x, y = math.cos(a) * rr, math.sin(a) * rr * 0.75
        gw_ground.blade(bm, x, y, 0, rnd.uniform(0.06, 0.2), a + rnd.uniform(-0.5, 0.5), rnd.uniform(0.3, 0.8), 0.006, k % 3)
    gm = bpy.data.meshes.new('gr')
    bm.to_mesh(gm)
    bm.free()
    go = gw_lib.link(bpy.data.objects.new('gr', gm), outline=False)
    for h_ in ('#a89a5e', '#8f8c4c', '#7c8243', '#5f6a3c'):
        go.data.materials.append(gw_ground.pmat(f'g{h_}', lin(h_), 0.65, 0.12, 0.0, 10, 0.3, 0.6))
    return root


def render(out):
    for i in range(VARIANTS):
        eisen.reset(samples=40)
        cliff(500 + i * 13)
        eisen.camera(*CANVAS, anchor=ANCHOR)
        name = f'cliff.{i}'
        out.add(name, 'flora', [out.render_frame(name, 0)], ANCHOR)
        eisen.reset(samples=24)
        cliff(500 + i * 13)
        eisen.shadow_render(out, f'{name}.shadow', 'flora', (3.5, 3.5), (1.4 / 3.5, 1.4 / 3.5), half=False)
