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
TONES = ('#6f675a', '#7b7263', '#625b50', '#857a69', '#5a544a')


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
    mats = [gw_ground.pmat(f'cl{seed}{i}', lin(t), 0.9, 0.38, 0.85, 7 + i) for i, t in enumerate(TONES)]
    o = []
    rot = rnd.uniform(-0.4, 0.4)
    # Schichten: unten breit, nach oben schmaler und nach Norden versetzt (Stufe zeigt nach Süden)
    layers = 4 + rnd.randint(0, 1)
    for k in range(layers):
        t = k / layers
        rx = 0.82 - 0.3 * t + rnd.uniform(-0.05, 0.05)
        ry = 0.55 - 0.25 * t + rnd.uniform(-0.04, 0.04)
        z = 0.08 + k * 0.17
        y = 0.05 + t * 0.32
        for j in range(2):
            ox = rnd.uniform(-0.25, 0.25)
            o.append(slab(f's{k}{j}', rx * rnd.uniform(0.6, 0.85), ry * rnd.uniform(0.7, 1.0), 0.12 + rnd.uniform(0, 0.05),
                          (ox, y + rnd.uniform(-0.05, 0.05), z), mats[(k + j + seed) % len(mats)], rnd, rot + rnd.uniform(-0.3, 0.3)))
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
