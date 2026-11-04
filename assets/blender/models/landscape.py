"""Landschaft (A5): Nadelbäume mit dem Blender-Add-on Sapling und Felsgruppen mit dem Add-on „Rock Generator“.

Beide Add-ons liegen der Blender-Installation bei (/usr/share/blender/scripts/addons); sie werden nur als
Werkzeug geladen, nichts davon wird ins Projekt kopiert. Ohne die Add-ons wird das Modell übersprungen.
Materialien und Licht wie bei der übrigen Flora (Gartenwerk), Schattenebene wie bei den Bäumen.
"""
import ast
import math
import os
import random
import sys

import bmesh
import bpy
import eisen
import gw_ground
import gw_lib
from mathutils import Euler

ADDONS = '/usr/share/blender/scripts/addons'
P = gw_lib.P
lin = gw_ground.lin
TAN = math.tan(eisen.TILT)

CONIFERS = [
    # (Vorlage, Höhe, Kronendurchmesser, Nadelfarbe, Rindenfarbe, Seed)
    ('douglas_fir', 7.5, 3.4, '#4b5f3f', '#4a3b2c', 3),
    ('douglas_fir', 6.2, 3.0, '#526443', '#4f3e2d', 11),
    ('small_pine', 6.8, 3.6, '#4b5d3c', '#5a4632', 5),
    ('small_pine', 5.6, 3.2, '#52623f', '#56432f', 17),
]


def addons_available():
    return os.path.isdir(os.path.join(ADDONS, 'add_curve_sapling'))


def load_addons():
    for p in (ADDONS, os.path.join(ADDONS, 'add_mesh_extra_objects')):
        if p not in sys.path:
            sys.path.append(p)
    import add_curve_sapling
    import add_mesh_rocks
    # Kompatibilität: der Felsgenerator (Blender 4.0) setzt Eigenschaften, die es in 5.x nicht mehr gibt
    if not hasattr(bpy.types.Mesh, 'use_auto_smooth'):
        bpy.types.Mesh.use_auto_smooth = bpy.props.BoolProperty()
        bpy.types.Mesh.auto_smooth_angle = bpy.props.FloatProperty()
    for mod in (add_curve_sapling, add_mesh_rocks):
        try:
            mod.register()
        except ValueError:
            pass  # bereits registriert


def preset(name):
    with open(os.path.join(ADDONS, 'add_curve_sapling', 'presets', f'{name}.py')) as f:
        src = f.read()
    return ast.literal_eval(src[src.index('{'):])


def plant_canvas(d, h):
    w = d + 1.0
    top = d / 2 + h * TAN + 0.3
    bottom = d / 2 + 0.4
    cw, ch = math.ceil(w * 2) / 2, math.ceil((top + bottom) * 2) / 2
    return (cw, ch), ((d / 2 + 0.5) / cw, top / ch)


def shadow(out, name, d, h):
    sw = math.ceil((d + 1 + h * 0.6) * 2) / 2
    sh = math.ceil((d + 1 + h * 0.75) * 2) / 2
    eisen.shadow_render(out, f'{name}.shadow', 'flora', (sw, sh), ((d / 2 + 0.5) / sw, (d / 2 + 0.5) / sh), half=True)


def conifer(kind, height, crown, needle, bark, seed):
    p = preset(kind)
    keep = set(bpy.ops.curve.tree_add.get_rna_type().properties.keys())
    args = {k: v for k, v in p.items() if k in keep}
    args.update(dict(do_update=True, seed=seed, showLeaves=True, bevel=True, makeMesh=False, armAnim=False,
                     scale=height, scaleV=height * 0.08, leafShape='rect'))
    args['leaves'] = max(args.get('leaves', 20), 40)
    if kind == 'small_pine':
        # dichtere, buschigere Nadeln als in der Vorlage
        args['leaves'] = args['leaves'] * 3
        args['leafScale'] = args.get('leafScale', 0.2) * 1.7
    bpy.ops.curve.tree_add(**args)
    tree = bpy.data.objects.get('tree')
    leaves = bpy.data.objects.get('leaves')
    bm = gw_ground.pmat('bark', lin(bark), 0.9, 0.3, 0.5, 30)
    nm = gw_ground.pmat('needles', lin(needle), 0.75, 0.2, 0.2, 40, 0.25, 0.5)
    if tree:
        tree.data.materials.clear()
        tree.data.materials.append(bm)
    if leaves:
        leaves.data.materials.clear()
        leaves.data.materials.append(nm)
    # Kronenbreite auf das Spielmaß bringen (Sapling skaliert nur über die Höhe)
    bpy.context.view_layer.update()
    ref = leaves or tree
    if ref:
        k = crown / max(0.1, max(ref.dimensions.x, ref.dimensions.y))
        for o in (tree, leaves):
            if o:
                o.scale = (k, k, 1.0)
    # Nadelstreu am Fuß
    rnd = random.Random(seed)
    bmh = bmesh.new()
    for k in range(400):
        a = rnd.uniform(0, math.tau)
        rr = crown * 0.4 * math.sqrt(rnd.random())
        gw_ground.blade(bmh, math.cos(a) * rr, math.sin(a) * rr, 0, rnd.uniform(0.03, 0.1), a, rnd.uniform(0.6, 1.0), 0.004, k % 3)
    me = bpy.data.meshes.new('litter')
    bmh.to_mesh(me)
    bmh.free()
    lo = gw_lib.link(bpy.data.objects.new('litter', me), outline=False)
    for h in ('#6b5236', '#7a6a45', '#5a4a30'):
        lo.data.materials.append(gw_ground.pmat(f'lit{h}', lin(h), 0.9, 0.12, 0.0, 10, 0.3, 0.6))


def rock_group(seed, n, spread, size):
    """Felsgruppe: mehrere Brocken aus dem Felsgenerator, eingesunken, mit Moos-/Grasfuß."""
    rnd = random.Random(seed)
    tones = ['#6a645a', '#756d61', '#5d5850', '#7a7164', '#686259']
    placed = []
    for i in range(n):
        before = set(bpy.data.objects)
        bpy.ops.mesh.add_mesh_rock(use_random_seed=False, user_seed=seed * 10 + i, use_generate=True)
        new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
        for ob in new:
            s = size * rnd.uniform(0.45, 1.0) * (1.4 if i == 0 else 1.0)
            dims = max(ob.dimensions)
            k = s / max(0.01, dims)
            ob.scale = (k * rnd.uniform(0.9, 1.3), k * rnd.uniform(0.9, 1.2), k * rnd.uniform(0.55, 0.85))
            a = rnd.uniform(0, math.tau)
            r = 0 if i == 0 else spread * math.sqrt(rnd.uniform(0.2, 1))
            ob.location = (math.cos(a) * r, math.sin(a) * r, s * 0.22)
            ob.rotation_euler = Euler((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6.28)))
            ob.data.materials.clear()
            ob.data.materials.append(gw_ground.pmat(f'rk{seed}{i}', lin(tones[(seed + i) % len(tones)]), 0.85, 0.35, 0.8, 9))
            for poly in ob.data.polygons:
                poly.use_smooth = True
            placed.append((ob.location.x, ob.location.y, s))
    bm = bmesh.new()
    for k in range(1400):
        x, y, s = placed[k % len(placed)]
        a = rnd.uniform(0, math.tau)
        rr = s * 0.55 * rnd.uniform(0.8, 1.5)
        gw_ground.blade(bm, x + math.cos(a) * rr, y + math.sin(a) * rr, 0, rnd.uniform(0.08, 0.25), a + rnd.uniform(-0.5, 0.5),
                        rnd.uniform(0.3, 0.8), 0.006, k % 3)
    gm = bpy.data.meshes.new('gr')
    bm.to_mesh(gm)
    bm.free()
    go = gw_lib.link(bpy.data.objects.new('gr', gm), outline=False)
    for h_ in ('#a89a5e', '#8f8c4c', '#7c8243', '#5f6a3c'):
        go.data.materials.append(gw_ground.pmat(f'g{h_}', lin(h_), 0.65, 0.12, 0.0, 10, 0.3, 0.6))
    return spread * 2 + size * 1.4


def render(out):
    if not addons_available():
        print('[landschaft] Blender-Add-ons fehlen – übersprungen')
        return
    for i, (kind, h, d, needle, bark, seed) in enumerate(CONIFERS):
        eisen.reset(samples=48)
        load_addons()
        conifer(kind, h, d, needle, bark, seed)
        canvas, anchor = plant_canvas(d, h)
        eisen.camera(*canvas, anchor=anchor)
        name = f'flora.conifer.{i}'
        out.add(name, 'flora', [out.render_frame(name, 0)], anchor)
        shadow(out, name, d, h)
    for i in range(4):
        eisen.reset(samples=48)
        load_addons()
        d = rock_group(300 + i * 7, 3 + i % 3, 0.55 + 0.15 * (i % 2), 0.9 + 0.2 * (i % 3))
        canvas, anchor = plant_canvas(d + 0.3, 1.2)
        eisen.camera(*canvas, anchor=anchor)
        name = f'flora.rocks.{i}'
        out.add(name, 'flora', [out.render_frame(name, 0)], anchor)
        eisen.shadow_render(out, f'{name}.shadow', 'flora', (math.ceil((d + 2.5) * 2) / 2,) * 2,
                            ((d / 2 + 0.6) / (math.ceil((d + 2.5) * 2) / 2),) * 2, half=False)
