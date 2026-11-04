"""Wasser mit natürlichem Ufer, gerendert nach dem Ecken-Prinzip (dual grid).

Jedes Sprite liegt auf einer Feldecke und deckt je ein Viertel der vier angrenzenden Felder ab.
Fall = Bitmaske der vier Felder (NW=1, NO=2, SW=4, SO=8; 1 = Wasser). Die Uferlinie folgt
f(x, y) = bilinear(Ecken) − 0,5 + Rauschen·Maske; die Maske ist auf dem Zellrand 0, deshalb
schneidet das Ufer jede Kante an derselben Stelle und alle Zellen passen aneinander.
Schichten: Uferschlamm (weich in die Wiese auslaufend, mit Böschung), Seegrund, Wasser mit
Himmelsspiegelung und periodischen Wellen (Periode 1 Feld), Ufersteine im Zellinneren.
"""
import math
import random

import bmesh
import bpy
import eisen
import gw_ground
import gw_lib
import seamless
from mathutils import Vector, noise

lin = gw_ground.lin
N = 40          # Gitterauflösung je Zelle
VARIANTS = 3


def field(case, x, y, seed):
    """Uferfeld: > 0 Wasser. x, y in [-0,5, 0,5] (Blender: +y = Norden)."""
    nw, ne, sw, se = (case >> 0) & 1, (case >> 1) & 1, (case >> 2) & 1, (case >> 3) & 1
    u = min(1.0, max(0.0, x + 0.5))
    v = min(1.0, max(0.0, y + 0.5))  # 0 = Süden, 1 = Norden
    top = nw + (ne - nw) * u
    bot = sw + (se - sw) * u
    b = bot + (top - bot) * v
    cx = max(-0.5, min(0.5, x))
    cy = max(-0.5, min(0.5, y))
    mask = (1 - 4 * cx * cx) * (1 - 4 * cy * cy)
    n = noise.noise(Vector((x * 3.1 + seed * 17.3, y * 3.1 - seed * 9.1, seed * 3.7)))
    n2 = noise.noise(Vector((x * 7.3 + seed * 5.1, y * 7.3 + seed * 2.3, 1.5 + seed)))
    amp = 0.12 if case == 15 else 1.0  # tiefes Wasser: kaum Formrauschen, gleichmäßige Tiefe
    return b - 0.5 + (0.32 * n + 0.12 * n2) * mask * amp


def grid_mesh(name, case, seed, zfun, attr):
    bm = bmesh.new()
    ext = 0.53
    verts = []
    for j in range(N + 1):
        row = []
        for i in range(N + 1):
            x = -ext + 2 * ext * i / N
            y = -ext + 2 * ext * j / N
            f = field(case, x, y, seed)
            row.append((bm.verts.new((x, y, zfun(f))), f))
        verts.append(row)
    for j in range(N):
        for i in range(N):
            bm.faces.new((verts[j][i][0], verts[j][i + 1][0], verts[j + 1][i + 1][0], verts[j + 1][i][0]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    # Feldwert als Attribut je Ecke
    at = me.attributes.new(attr, 'FLOAT', 'POINT')
    flat = [f for row in verts for (_, f) in row]
    for k, f in enumerate(flat):
        at.data[k].value = f
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    eisen.link(o)
    return o


def attr_node(nt, name):
    a = nt.nodes.new('ShaderNodeAttribute')
    a.attribute_name = name
    return a.outputs['Fac']


def ramp(nt, src, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    cr = r.color_ramp
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        e = cr.elements.new(pos)
        e.color = (*col, 1)
    nt.links.new(src, r.inputs['Fac'])
    return r.outputs['Color']


def with_alpha(m, alpha_socket):
    nt = m.node_tree
    out = nt.nodes['Material Output']
    bsdf = nt.nodes['Principled BSDF']
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(alpha_socket, mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(bsdf.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    if hasattr(m, 'blend_method'):
        m.blend_method = 'BLEND'


def bank_material():
    """Uferschlamm: von trockener Erde (Rand, transparent auslaufend) zu nassem, dunklem Schlamm."""
    m, b = gw_lib._principled('bank')
    nt = m.node_tree
    f = attr_node(nt, 'f')
    col = ramp(nt, f, [(0.0, lin('#5e4b35')), (0.55, lin('#3f3326')), (0.75, lin('#2f2a22')), (1.0, lin('#3a3a30'))])
    # f in [-0.35, 0.15] -> 0..1
    mr = nt.nodes.new('ShaderNodeMapRange')
    nt.links.new(f, mr.inputs['Value'])
    mr.inputs['From Min'].default_value = -0.35
    mr.inputs['From Max'].default_value = 0.15
    nt.links.new(mr.outputs['Result'], col.node.inputs['Fac'])
    nt.links.new(col, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.75
    nz = seamless.noise4(nt, 2.0, (1, 2, 3, 4), detail=5, scale=2.0)
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.6
    nt.links.new(nz.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    al = nt.nodes.new('ShaderNodeMapRange')
    nt.links.new(f, al.inputs['Value'])
    al.inputs['From Min'].default_value = -0.36
    al.inputs['From Max'].default_value = -0.2
    with_alpha(m, al.outputs['Result'])
    gw_lib._ao(m, 0.6, 0.05)
    return m


def water_material():
    """Wasser: flach grünbraun am Ufer, tief blaugrau, spiegelt den Himmel, Wellen periodisch."""
    m, b = gw_lib._principled('water')
    nt = m.node_tree
    f = attr_node(nt, 'f')
    mr = nt.nodes.new('ShaderNodeMapRange')
    nt.links.new(f, mr.inputs['Value'])
    mr.inputs['From Min'].default_value = 0.0
    mr.inputs['From Max'].default_value = 0.45
    col = ramp(nt, mr.outputs['Result'], [(0.0, lin('#59614a')), (0.3, lin('#3e4c45')), (1.0, lin('#1f2c33'))])
    nt.links.new(col, b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.07
    b.inputs['Specular IOR Level'].default_value = 0.6
    waves = seamless.noise4(nt, 7.0, (4, 3, 2, 1), detail=2, scale=1.4)
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.08
    bump.inputs['Distance'].default_value = 0.004
    nt.links.new(waves.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    al = nt.nodes.new('ShaderNodeMapRange')
    nt.links.new(f, al.inputs['Value'])
    al.inputs['From Min'].default_value = -0.01
    al.inputs['From Max'].default_value = 0.16
    with_alpha(m, al.outputs['Result'])
    return m


def bank_height(f):
    """Böschung: Land 0, fällt zum Wasser ab, Seegrund tiefer."""
    if f < -0.3:
        return 0.0
    if f < 0.05:
        t = (f + 0.3) / 0.35
        return -0.1 * t * t * (3 - 2 * t)
    return -0.1 - 0.12 * min(1.0, (f - 0.05) / 0.4)


def shore_stones(case, seed, rnd):
    tones = ['#6f685c', '#5d574d', '#7e7668', '#4e4a43']
    mats = [gw_ground.pmat(f'ss{i}', lin(h), 0.6, 0.25, 0.4, 25, 0.45) for i, h in enumerate(tones)]
    meshes = [gw_ground.pebble_mesh(f'sm{i}', 1.0, rnd, 0.55, 2, True, 0.05) for i in range(6)]
    n = 0
    for _ in range(300):
        if n >= 9:
            break
        x, y = rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4)
        f = field(case, x, y, seed)
        if not (-0.16 < f < 0.03):
            continue
        r = rnd.uniform(0.018, 0.05)
        if abs(x) > 0.5 - r * 1.5 or abs(y) > 0.5 - r * 1.5:
            continue
        o = bpy.data.objects.new('ss', meshes[n % 6])
        o.scale = (r, r * rnd.uniform(0.7, 1.0), r)
        o.location = (x, y, bank_height(f) + r * 0.2)
        o.rotation_euler = (0, 0, rnd.uniform(0, 6.28))
        eisen.link(o)
        if not o.data.materials:
            o.data.materials.append(mats[0])
        o.material_slots[0].link = 'OBJECT'
        o.material_slots[0].material = mats[n % len(mats)]
        n += 1


def render(out):
    for case in range(1, 16):
        for v in range(VARIANTS):
            eisen.reset(samples=48, ground=False)
            seed = case * 7 + v * 31 + 1
            rnd = random.Random(seed)
            bank = grid_mesh('bank', case, seed, bank_height, 'f')
            bank.data.materials.append(bank_material())
            water = grid_mesh('water', case, seed, lambda f: -0.035, 'f')
            water.data.materials.append(water_material())
            shore_stones(case, seed, rnd)
            eisen.camera(1, 1, target=(0, 0, -0.035))
            name = f'water.{case}.{v}'
            out.add(name, 'water', [out.render_frame(name, 0)], (0.5, 0.5))
