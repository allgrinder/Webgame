"""Gebäude im Natur-Stil (Phase A1): verwittertes Metall, Naturstein, Staub und Schmutz.

Alle Gebäude sind für Richtung Nord gebaut (Ausgabe nach +Y), mittig um den Ursprung, 1 Feld = 1 m.
Licht und Szene kommen aus gw_lib.reset_scene (über eisen.reset).
"""
import math
import random

import bmesh
import bpy
import eisen
import gw_ground
import gw_lib
from mathutils import Euler, Vector

lin = gw_ground.lin


# --------------------------------------------------------------------------- Materialien

def _n(nt, typ, **kw):
    n = nt.nodes.new(typ)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def _math(nt, op, a=None, b=None, va=0.0, vb=0.0):
    m = _n(nt, 'ShaderNodeMath', operation=op)
    if a is not None:
        nt.links.new(a, m.inputs[0])
    else:
        m.inputs[0].default_value = va
    if b is not None:
        nt.links.new(b, m.inputs[1])
    else:
        m.inputs[1].default_value = vb
    return m.outputs[0]


def _mix(nt, fac, a, b):
    m = _n(nt, 'ShaderNodeMix', data_type='RGBA')
    nt.links.new(fac, m.inputs['Factor'])
    if isinstance(a, tuple):
        m.inputs[6].default_value = (*a, 1)
    else:
        nt.links.new(a, m.inputs[6])
    if isinstance(b, tuple):
        m.inputs[7].default_value = (*b, 1)
    else:
        nt.links.new(b, m.inputs[7])
    return m.outputs[2]


def _noise(nt, vec, scale, detail=5, rough=0.55):
    t = _n(nt, 'ShaderNodeTexNoise')
    t.inputs['Scale'].default_value = scale
    t.inputs['Detail'].default_value = detail
    t.inputs['Roughness'].default_value = rough
    nt.links.new(vec, t.inputs['Vector'])
    return t.outputs['Fac']


def _band(nt, val, lo, hi):
    """weicher Schwellwert: 0 unter lo, 1 über hi"""
    r = _n(nt, 'ShaderNodeMapRange', clamp=True)
    nt.links.new(val, r.inputs['Value'])
    r.inputs['From Min'].default_value = lo
    r.inputs['From Max'].default_value = hi
    return r.outputs['Result']


def weathered(name, hex_, metal=0.6, rough=0.55, rust=0.3, dust=0.5, edge=0.4, grime=0.5, streaks=0.3,
              scale=1.0, rust_hex='#6e3a1e', dust_hex='#8c7c62'):
    """Verwittertes Material: Grundton mit Schwankung, Rostflecken und Laufspuren, Staub auf Oberseiten,
    Kantenabrieb, Schmutz zum Boden hin, Umgebungsverdeckung."""
    m, b = gw_lib._principled(name)
    nt = m.node_tree
    L = nt.links
    tc = _n(nt, 'ShaderNodeTexCoord')
    obj = tc.outputs['Object']
    geo = _n(nt, 'ShaderNodeNewGeometry')
    sep = _n(nt, 'ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Generated'] if False else geo.outputs['Position'], sep.inputs[0])
    base = lin(hex_)
    var = _noise(nt, obj, 6 * scale, 4)
    col = _mix(nt, _band(nt, var, 0.3, 0.7), tuple(c * 0.82 for c in base), tuple(min(1, c * 1.15) for c in base))
    met = _n(nt, 'ShaderNodeValue')
    met.outputs[0].default_value = metal
    rgh = _n(nt, 'ShaderNodeValue')
    rgh.outputs[0].default_value = rough
    metal_s = met.outputs[0]
    rough_s = rgh.outputs[0]
    if rust > 0:
        rn = _noise(nt, obj, 9 * scale, 8, 0.65)
        rmask = _band(nt, rn, 1 - rust * 0.55, 1 - rust * 0.55 + 0.08)
        # Laufspuren: in z gestrecktes Rauschen
        mp = _n(nt, 'ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (14 * scale, 14 * scale, 1.2 * scale)
        L.new(obj, mp.inputs['Vector'])
        sn = _noise(nt, mp.outputs['Vector'], 1.0, 3)
        smask = _math(nt, 'MULTIPLY', _band(nt, sn, 0.62, 0.72), vb=streaks)
        rall = _math(nt, 'MAXIMUM', rmask, smask)
        rcol = _mix(nt, _band(nt, _noise(nt, obj, 30 * scale, 3), 0.3, 0.7), lin(rust_hex), tuple(c * 0.7 for c in lin(rust_hex)))
        col = _mix(nt, rall, col, rcol)
        metal_s = _math(nt, 'MULTIPLY', metal_s, _math(nt, 'SUBTRACT', va=1.0, b=rall))
        rough_s = _math(nt, 'MAXIMUM', rough_s, _math(nt, 'MULTIPLY', rall, vb=0.92))
    if edge > 0:
        ed = _band(nt, geo.outputs['Pointiness'], 0.52, 0.52 + 0.1 / max(0.05, edge))
        col = _mix(nt, _math(nt, 'MULTIPLY', ed, vb=0.8), col, tuple(min(1, c * 1.5 + 0.06) for c in base))
    if grime > 0:
        gz = _math(nt, 'SUBTRACT', va=1.0, b=_band(nt, sep.outputs['Z'], 0.0, 0.45))
        gmask = _math(nt, 'MULTIPLY', gz, _math(nt, 'MULTIPLY', _band(nt, _noise(nt, obj, 4 * scale, 4), 0.25, 0.75), vb=grime))
        col = _mix(nt, gmask, col, (0.035, 0.03, 0.022))
    if dust > 0:
        nz = _n(nt, 'ShaderNodeSeparateXYZ')
        L.new(geo.outputs['Normal'], nz.inputs[0])
        up = _band(nt, nz.outputs['Z'], 0.55, 0.95)
        dmask = _math(nt, 'MULTIPLY', up, _math(nt, 'MULTIPLY', _band(nt, _noise(nt, obj, 12 * scale, 5), 0.35, 0.8), vb=dust))
        col = _mix(nt, dmask, col, lin(dust_hex))
        rough_s = _math(nt, 'MAXIMUM', rough_s, dmask)
        metal_s = _math(nt, 'MULTIPLY', metal_s, _math(nt, 'SUBTRACT', va=1.0, b=dmask))
    L.new(col, b.inputs['Base Color'])
    L.new(metal_s, b.inputs['Metallic'])
    L.new(rough_s, b.inputs['Roughness'])
    bump = _n(nt, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.25
    bump.inputs['Distance'].default_value = 0.01
    L.new(_noise(nt, obj, 60 * scale, 4), bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    gw_lib._ao(m, 0.75, 0.12)
    return m


class Mats:
    def __init__(self):
        self.steel = weathered('w_steel', '#4c4c47', metal=0.7, rough=0.5, rust=0.35, dust=0.55, edge=0.5)
        self.dark = weathered('w_dark', '#2e2e2b', metal=0.6, rough=0.55, rust=0.3, dust=0.5, edge=0.4)
        self.paint = weathered('w_paint', '#7d6231', metal=0.2, rough=0.6, rust=0.4, dust=0.6, edge=0.7, streaks=0.5)
        self.brass = weathered('w_brass', '#87703f', metal=0.85, rough=0.35, rust=0.15, dust=0.35, edge=0.6,
                               rust_hex='#4b5a40')
        self.bright = weathered('w_bright', '#8a8d90', metal=0.9, rough=0.3, rust=0.1, dust=0.2, edge=0.2, grime=0.2)
        self.rubber = weathered('w_rubber', '#232220', metal=0.0, rough=0.85, rust=0.0, dust=0.4, edge=0.0)
        self.soot = gw_ground.pmat('w_soot', lin('#1a1816'), 0.95, 0.3, 0.4, 20)
        self.earth = gw_ground.pmat('w_earth', lin('#4f3f2e'), 1.0, 0.3, 0.6, 25)


# --------------------------------------------------------------------------- Hilfen

def bolts(objs, mat, pts, z, r=0.022, axis='Z'):
    rot = {'Z': (0, 0, 0), 'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0)}[axis]
    for i, p in enumerate(pts):
        loc = (p[0], p[1], z) if len(p) == 2 else p
        objs.append(eisen.cylinder(f'bolt{i}', r, 0.025, loc, mat, segments=6, rot=rot))


def beam(name, a, b, size, mat):
    """Quader von Punkt a nach b (Querschnitt size)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = eisen.box(name, (size[0], d.length, size[1]), tuple((a + b) / 2), mat, bevel=0.008)
    o.rotation_euler = Vector((0, 1, 0)).rotation_difference(d.normalized()).to_euler()
    return o


def pipe(name, a, b, r, mat, seg=12):
    a, b = Vector(a), Vector(b)
    d = b - a
    o = eisen.cylinder(name, r, d.length, tuple((a + b) / 2), mat, segments=seg)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def gear(name, r_out, r_in, teeth, depth, mat):
    bm = bmesh.new()
    n = teeth * 4
    pts = []
    for i in range(n):
        a = i / n * math.tau
        r = r_out if i % 4 in (1, 2) else r_in
        pts.append((math.cos(a) * r, math.sin(a) * r))
    top = [bm.verts.new((x, y, depth / 2)) for x, y in pts]
    bot = [bm.verts.new((x, y, -depth / 2)) for x, y in pts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = eisen.mesh_obj(name, bm, mat)
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = 0.006
    m.segments = 1
    return o


def wheel(name, r, w, spokes, mat, hub_mat):
    """Speichenrad in der xz-Ebene (Achse y), für ein Schwungrad."""
    objs = []
    rim = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=r, radius2=r, depth=w)
    inner = bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=r * 0.82, radius2=r * 0.82, depth=w * 1.4)
    bm.to_mesh(rim)
    bm.free()
    ro = bpy.data.objects.new(name, rim)
    eisen.link(ro)
    ro.data.materials.append(mat)
    cut = eisen.cylinder(name + 'c', r * 0.82, w * 3, (0, 0, 0), mat, segments=32)
    mod = ro.modifiers.new('cut', 'BOOLEAN')
    mod.object = cut
    mod.operation = 'DIFFERENCE'
    cut.hide_render = True
    objs.append(ro)
    for k in range(spokes):
        a = k / spokes * math.tau
        objs.append(beam(f'{name}s{k}', (0, 0, 0), (math.cos(a) * r * 0.84, math.sin(a) * r * 0.84, 0), (0.035, 0.03), mat))
    objs.append(eisen.cylinder(name + 'h', r * 0.18, w * 1.6, (0, 0, 0), hub_mat, segments=16))
    root = eisen.parent_all(objs, name + 'root')
    inner  # noqa: B018
    return root


def stones(n, rnd, mats, region, size, z0=0.0, flat=0.5, angular=True):
    """Lose Steine/Abraum: region(x, y) -> bool, Positionen im Quadrat ±1."""
    meshes = [gw_ground.pebble_mesh(f'st{i}', 1.0, rnd, flat, 1 if angular else 2, not angular, 0.22) for i in range(8)]
    objs = []
    tries = 0
    while len(objs) < n and tries < n * 20:
        tries += 1
        x, y = rnd.uniform(-1, 1), rnd.uniform(-1, 1)
        if not region(x, y):
            continue
        s = rnd.uniform(*size)
        o = bpy.data.objects.new('st', meshes[len(objs) % len(meshes)])
        o.scale = (s, s * rnd.uniform(0.7, 1.1), s)
        o.location = (x, y, z0 + s * flat * 0.4)
        o.rotation_euler = Euler((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6.28)))
        eisen.link(o)
        o.data.materials.append(mats[0]) if not o.data.materials else None
        o.material_slots[0].link = 'OBJECT'
        o.material_slots[0].material = mats[len(objs) % len(mats)]
        objs.append(o)
    return objs


# --------------------------------------------------------------------------- Brennstoff-Bohrer

def drill(m, phase=0.0, working=True, seed=5):
    """Kufenrahmen mit Bohrturm, Getriebe, Schwungrad, Brennkammer mit Schornstein und Ausgaberutsche
    (Nord, linke Hälfte). Abraum um den Bohrkopf."""
    rnd = random.Random(seed)
    o = []
    a = phase * math.tau
    jit = 0.004 * math.sin(a * 4) if working else 0.0
    # Kufen und Querträger (gestrichen)
    for s in (-1, 1):
        o.append(eisen.box(f'skid{s}', (0.16, 1.9, 0.16), (s * 0.78, 0, 0.08), m.paint, bevel=0.015))
    for y in (-0.75, 0.0, 0.75):
        o.append(eisen.box(f'cross{y}', (1.6, 0.12, 0.1), (0, y, 0.17), m.dark, bevel=0.01))
    bolts(o, m.bright, [(s * 0.78, y) for s in (-1, 1) for y in (-0.75, 0.0, 0.75)], 0.17, 0.025)
    # Deckplatte mit Öffnung für das Bohrgestänge
    deck = eisen.box('deck', (1.62, 1.66, 0.05), (0, 0, 0.245), m.steel, bevel=0.01)
    cut = eisen.cylinder('deckcut', 0.2, 0.3, (-0.1, 0.1, 0.24), m.steel, segments=24)
    mod = deck.modifiers.new('cut', 'BOOLEAN')
    mod.object = cut
    mod.operation = 'DIFFERENCE'
    cut.hide_render = True
    o.append(deck)
    # Bohrgestänge (dreht sich) und Turm
    tx, ty = -0.1, 0.1
    rod = eisen.cylinder('rod', 0.055, 0.9, (tx, ty, 0.2), m.bright, segments=12)
    rod.rotation_euler = (0, 0, a)
    o.append(rod)
    for k in range(4):  # Stützen
        ang = k * math.pi / 2 + math.pi / 4
        o.append(beam(f'leg{k}', (tx + math.cos(ang) * 0.32, ty + math.sin(ang) * 0.32, 0.27),
                      (tx + math.cos(ang) * 0.14, ty + math.sin(ang) * 0.14, 0.95 + jit), (0.05, 0.05), m.paint))
    o.append(eisen.cylinder('collar', 0.16, 0.12, (tx, ty, 0.33), m.dark, segments=24, bevel=0.01))
    o.append(eisen.cylinder('housing', 0.19, 0.2, (tx, ty, 0.98 + jit), m.dark, segments=24, bevel=0.015))
    g = gear('crown', 0.27, 0.23, 18, 0.05, m.brass)
    g.location = (tx, ty, 1.11 + jit)
    g.rotation_euler = (0, 0, a / 18 * 4)
    o.append(g)
    o.append(eisen.cylinder('cap', 0.1, 0.08, (tx, ty, 1.17 + jit), m.steel, segments=16, bevel=0.01))
    # Ritzel vom Antrieb
    p = gear('pinion', 0.1, 0.075, 8, 0.05, m.brass)
    p.location = (tx + 0.34, ty - 0.08, 1.11 + jit)
    p.rotation_euler = (0, 0, -a / 8 * 4)
    o.append(p)
    o.append(pipe('shaft', (tx + 0.34, ty - 0.08, 1.11), (tx + 0.34, ty - 0.08, 0.72), 0.03, m.steel))
    # Brennkammer hinten rechts
    o.append(eisen.box('firebox', (0.62, 0.56, 0.5), (0.45, -0.5, 0.52), m.dark, bevel=0.03))
    o.append(eisen.box('fireboxband', (0.66, 0.6, 0.05), (0.45, -0.5, 0.74), m.paint, bevel=0.01))
    o.append(eisen.box('door', (0.3, 0.03, 0.22), (0.45, -0.79, 0.47), m.steel, bevel=0.01))
    o.append(eisen.box('slit', (0.2, 0.012, 0.025), (0.45, -0.81, 0.43),
                       eisen.emission_material('ember', (1.0, 0.33, 0.06), 6.0 if working else 0.0)))
    bolts(o, m.bright, [(0.45 + dx, -0.79, 0.47 + dz) for dx in (-0.13, 0.13) for dz in (-0.09, 0.09)], 0, 0.014, 'Y')
    o.append(eisen.cylinder('stack', 0.075, 0.62, (0.6, -0.58, 1.05), m.dark, segments=16))
    o.append(eisen.cylinder('stackcap', 0.11, 0.05, (0.6, -0.58, 1.38), m.steel, segments=16, bevel=0.01))
    o.append(eisen.cylinder('stackin', 0.055, 0.06, (0.6, -0.58, 1.395), m.soot, segments=12))
    # Schwungrad links mit Kurbel und Zylinder
    wh = wheel('fly', 0.3, 0.06, 6, m.dark, m.steel)
    wh.location = (-0.66, -0.35, 0.62)
    wh.rotation_euler = (0, a, math.pi / 2)
    o.append(wh)
    crank = (-0.6, -0.35 + math.cos(a) * 0.12, 0.62 + math.sin(a) * 0.12)
    o.append(eisen.box('cyl', (0.2, 0.42, 0.2), (-0.45, 0.25, 0.42), m.steel, bevel=0.03))
    o.append(pipe('conrod', crank, (-0.45, 0.02, 0.42), 0.022, m.bright))
    o.append(eisen.cylinder('axle', 0.04, 0.5, (-0.48, -0.35, 0.62), m.bright, segments=12, rot=(0, math.pi / 2, 0)))
    o.append(eisen.box('bearing', (0.14, 0.16, 0.36), (-0.32, -0.35, 0.44), m.paint, bevel=0.02))
    # Ausgaberutsche Nord, linke Hälfte
    ch = eisen.box('chute', (0.4, 0.5, 0.04), (-0.35, 0.86, 0.33), m.steel, rot=(math.radians(-22), 0, 0))
    o.append(ch)
    for s in (-1, 1):
        o.append(eisen.box(f'chuteside{s}', (0.03, 0.5, 0.1), (-0.35 + s * 0.2, 0.86, 0.37), m.paint, rot=(math.radians(-22), 0, 0)))
    # Geländer
    o.append(pipe('rail1', (0.15, 0.78, 0.27), (0.15, 0.78, 0.7), 0.018, m.paint))
    o.append(pipe('rail2', (0.75, 0.78, 0.27), (0.75, 0.78, 0.7), 0.018, m.paint))
    o.append(pipe('rail3', (0.15, 0.78, 0.7), (0.75, 0.78, 0.7), 0.018, m.paint))
    # Abraum und Erdreich an den Kufen
    earth = [m.earth, gw_ground.pmat('w_earth2', lin('#5d4a35'), 1.0, 0.3, 0.6, 25),
             gw_ground.pmat('w_rock', lin('#6b6458'), 0.9, 0.25, 0.4, 25)]
    o.extend(stones(70, rnd, earth, lambda x, y: (abs(abs(x) - 0.92) < 0.12 or abs(abs(y) - 0.93) < 0.1), (0.03, 0.07)))
    root = eisen.parent_all(o, 'drill')
    return root


# --------------------------------------------------------------------------- Steinofen

def furnace(fire=0.0, seed=3):
    """Runder Ofen aus Natursteinen mit Lehmfugen, Feueröffnung nach Süden (zur Kamera), Steinkamin."""
    rnd = random.Random(seed)
    o = []
    stone_tones = ['#8a7d68', '#7a6e5c', '#958771', '#6c6152', '#857660', '#9b8e78']
    smats = [gw_ground.pmat(f'fs{i}', lin(h), 0.92, 0.25, 0.7, 14) for i, h in enumerate(stone_tones)]
    for sm in smats:
        gw_lib._ao(sm, 0.8, 0.08)
    soot = [gw_ground.pmat(f'fso{i}', lin(h), 0.95, 0.3, 0.7, 14) for i, h in enumerate(['#3a332b', '#2b2622', '#4a4135'])]
    clay = gw_ground.pmat('clay', lin('#7d6a52'), 1.0, 0.3, 0.8, 18)
    gw_lib._ao(clay, 0.85, 0.1)
    meshes = [gw_ground.pebble_mesh(f'fm{i}', 1.0, rnd, 0.62, 1, False, 0.2) for i in range(12)]
    open_a = -math.pi / 2  # Süden
    open_w = 0.42
    # Fundament
    for i in range(16):
        ang = i / 16 * math.tau
        s = eisen.box  # noqa: F841
        ob = bpy.data.objects.new('fd', meshes[i % 12])
        ob.scale = (0.2, 0.15, 0.08)
        ob.location = (math.cos(ang) * 0.86, math.sin(ang) * 0.86, 0.04)
        ob.rotation_euler = (0, 0, ang + math.pi / 2 + rnd.uniform(-0.2, 0.2))
        eisen.link(ob)
        ob.data.materials.append(smats[0]) if not ob.data.materials else None
        ob.material_slots[0].link = 'OBJECT'
        ob.material_slots[0].material = smats[i % len(smats)]
        o.append(ob)
    # Steinlagen
    layers = 7
    for k in range(layers):
        r = 0.82 - k * 0.055
        z = 0.12 + k * 0.13
        n = int(2 * math.pi * r / 0.24)
        off = rnd.random() * math.tau
        o.append(eisen.cylinder(f'core{k}', r - 0.06, 0.14, (0, 0, z), clay, segments=32))
        for i in range(n):
            ang = off + i / n * math.tau
            da = math.atan2(math.sin(ang - open_a), math.cos(ang - open_a))
            if k < 3 and abs(da) < open_w:
                continue
            ob = bpy.data.objects.new('fs', meshes[(k * 5 + i) % 12])
            w = 2 * math.pi * r / n * 0.52
            ob.scale = (w * rnd.uniform(0.9, 1.1), 0.1 * rnd.uniform(0.9, 1.15), 0.065 * rnd.uniform(0.9, 1.1))
            ob.location = (math.cos(ang) * r, math.sin(ang) * r, z + rnd.uniform(-0.01, 0.01))
            ob.rotation_euler = (rnd.uniform(-0.06, 0.06), rnd.uniform(-0.06, 0.06), ang + math.pi / 2)
            eisen.link(ob)
            ob.data.materials.append(smats[0]) if not ob.data.materials else None
            ob.material_slots[0].link = 'OBJECT'
            near_open = abs(da) < open_w + 0.35 and k >= 2 and k <= 4
            ob.material_slots[0].material = (soot if near_open or (k >= 5 and rnd.random() < 0.35) else smats)[rnd.randrange(3 if near_open else len(smats))]
            o.append(ob)
    # Kuppel aus Lehm, Kamin aus Steinen hinten
    dome = bpy.data.meshes.new('dome')
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=12, radius=0.5)
    for v in bm.verts:
        if v.co.z < 0:
            v.co.z = 0
        v.co.z *= 0.45
    bm.to_mesh(dome)
    bm.free()
    do = bpy.data.objects.new('dome', dome)
    do.location = (0, 0, 0.95)
    eisen.link(do)
    do.data.materials.append(clay)
    for p in dome.polygons:
        p.use_smooth = True
    o.append(do)
    cx, cy = 0.12, 0.3
    for k in range(4):
        n = 6
        for i in range(n):
            ang = i / n * math.tau + k * 0.5
            ob = bpy.data.objects.new('ch', meshes[(k + i) % 12])
            ob.scale = (0.09, 0.07, 0.05)
            ob.location = (cx + math.cos(ang) * 0.15, cy + math.sin(ang) * 0.15, 1.05 + k * 0.09)
            ob.rotation_euler = (0, 0, ang + math.pi / 2)
            eisen.link(ob)
            ob.data.materials.append(smats[0]) if not ob.data.materials else None
            ob.material_slots[0].link = 'OBJECT'
            ob.material_slots[0].material = (soot if k == 3 else smats)[i % 3]
            o.append(ob)
    o.append(eisen.cylinder('flue', 0.1, 0.42, (cx, cy, 1.18), m_soot(soot), segments=16))
    # Öffnung: Eisenrahmen, Rußhöhle, Glut
    o.append(eisen.box('cave', (0.62, 0.5, 0.36), (0, -0.55, 0.28), soot[1]))
    iron = weathered('w_iron', '#2f2d2a', metal=0.6, rough=0.6, rust=0.5, dust=0.3, edge=0.4)
    o.append(eisen.box('lintel', (0.7, 0.1, 0.07), (0, -0.78, 0.5), iron, bevel=0.01))
    o.append(pipe('jambL', (-0.3, -0.76, 0.1), (-0.3, -0.76, 0.5), 0.025, iron))
    o.append(pipe('jambR', (0.3, -0.76, 0.1), (0.3, -0.76, 0.5), 0.025, iron))
    fire_objs = []
    if fire > 0:
        fm = eisen.emission_material('fire', (1.0, 0.42, 0.1), 5.0 * fire)
        for i in range(6):
            r = 0.05 + rnd.random() * 0.04
            f = eisen.rock(f'fire{i}', r, (-0.18 + i * 0.07, -0.66 + rnd.random() * 0.06, 0.16 + rnd.random() * 0.05 * fire),
                           fm, seed + i, squash=1.1 + fire, detail=1)
            fire_objs.append(f)
        coal = eisen.material('embers', (0.04, 0.02, 0.01), rough=0.9, emission=(1.0, 0.25, 0.05), emission_strength=1.0 + 2.5 * fire)
        o.append(eisen.box('emberbed', (0.5, 0.25, 0.05), (0, -0.62, 0.13), coal))
        light = bpy.data.lights.new('firelight', 'POINT')
        light.energy = 40 * fire
        light.color = (1.0, 0.55, 0.25)
        light.shadow_soft_size = 0.15
        lo = bpy.data.objects.new('firelight', light)
        lo.location = (0, -0.68, 0.3)
        eisen.link(lo)
    else:
        o.append(eisen.box('ash', (0.5, 0.25, 0.04), (0, -0.62, 0.12), gw_ground.pmat('ash', lin('#4a4540'), 1.0, 0.3, 0.5, 30)))
    o.extend(fire_objs)
    # Asche und Kohlebrocken vor der Öffnung
    ash = [gw_ground.pmat(f'ash{i}', lin(h), 1.0, 0.3, 0.4, 30) for i, h in enumerate(['#3d3934', '#24211e', '#55504a'])]
    o.extend(stones(22, rnd, ash, lambda x, y: y < -0.82 and abs(x) < 0.45 and y > -0.98, (0.015, 0.035), flat=0.4))
    root = eisen.parent_all(o, 'furnace')
    return root, fire_objs


def m_soot(soot):
    return soot[1]


# --------------------------------------------------------------------------- Greifarm

ARM_REACH = 1.1   # waagerechte Reichweite der Hand (Mittel aus Aufnahme 1,0 und Ablage 1,2)
HAND_Z = 0.3      # Höhe der Hand über dem Boden


def inserter_base(m):
    o = []
    o.append(eisen.cylinder('plate', 0.34, 0.06, (0, 0, 0.03), m.dark, segments=32, bevel=0.01))
    bolts(o, m.bright, [(math.cos(a) * 0.27, math.sin(a) * 0.27) for a in [i * math.tau / 6 for i in range(6)]], 0.065, 0.02)
    o.append(eisen.cylinder('ped', 0.15, 0.16, (0, 0, 0.14), m.steel, segments=24, bevel=0.01))
    o.append(eisen.cylinder('ring', 0.2, 0.05, (0, 0, 0.23), m.paint, segments=32, bevel=0.01))
    return eisen.parent_all(o, 'inserterBase')


def inserter_arm(m, reach=ARM_REACH, hand_z=HAND_Z, grip=0.0):
    """Drehteller mit Brennkammer, Ober- und Unterarm, Greifer. Arm zeigt nach Norden (+Y)."""
    o = []
    o.append(eisen.cylinder('turret', 0.17, 0.1, (0, 0, 0.3), m.dark, segments=24, bevel=0.01))
    o.append(eisen.box('burner', (0.2, 0.16, 0.14), (0, -0.16, 0.38), m.paint, bevel=0.015))
    o.append(eisen.box('burnslit', (0.1, 0.01, 0.02), (0, -0.245, 0.37), eisen.emission_material('ember', (1.0, 0.35, 0.08), 3.0)))
    o.append(eisen.cylinder('burnstack', 0.025, 0.14, (0.06, -0.2, 0.5), m.dark, segments=10))
    sh = Vector((0, 0.04, 0.46))  # Schulter
    hand = Vector((0, reach, hand_z + 0.08))
    a1 = 0.68
    a2 = 0.62
    d = (hand - sh).length
    # Ellbogen per Kosinussatz, nach oben geknickt
    cosb = max(-1.0, min(1.0, (a1 * a1 + d * d - a2 * a2) / (2 * a1 * d)))
    b = math.acos(cosb)
    dirv = (hand - sh).normalized()
    up = Vector((0, -dirv.z, dirv.y))  # senkrecht in der yz-Ebene, nach oben
    elbow = sh + dirv * (a1 * math.cos(b)) + up * (a1 * math.sin(b))
    o.append(beam('upper', sh, elbow, (0.07, 0.07), m.paint))
    o.append(beam('upper2', sh + Vector((0.04, 0, 0)), elbow + Vector((0.04, 0, 0)), (0.02, 0.03), m.steel))
    o.append(eisen.cylinder('elbow', 0.05, 0.12, tuple(elbow), m.dark, segments=16, rot=(0, math.pi / 2, 0)))
    o.append(beam('fore', elbow, hand, (0.055, 0.055), m.paint))
    o.append(eisen.cylinder('shoulder', 0.06, 0.14, tuple(sh), m.dark, segments=16, rot=(0, math.pi / 2, 0)))
    o.append(pipe('hydr', sh + Vector((0, -0.05, -0.08)), elbow + Vector((0, 0, -0.06)), 0.015, m.bright))
    # Greifer
    o.append(eisen.box('wrist', (0.12, 0.06, 0.06), tuple(hand + Vector((0, 0.02, -0.02))), m.dark, bevel=0.01))
    for s in (-1, 1):
        o.append(eisen.box(f'claw{s}', (0.025, 0.05, 0.1), tuple(hand + Vector((s * (0.045 - grip * 0.02), 0.04, -0.08))), m.steel, bevel=0.005))
    return eisen.parent_all(o, 'inserterArm')


# --------------------------------------------------------------------------- Band (Endkappen)

def belt_cap(m, end=True):
    """Umlenktrommel mit Lagerböcken am Band-Ende (end) bzw. Anfang, Band läuft nach Norden."""
    o = []
    y = 0.5 if end else -0.5
    o.append(eisen.cylinder('drum', 0.06, 0.78, (0, y, 0.05), m.dark, segments=20, rot=(0, math.pi / 2, 0)))
    for s in (-1, 1):
        o.append(eisen.box(f'block{s}', (0.09, 0.14, 0.13), (s * 0.44, y, 0.065), m.paint, bevel=0.012))
        o.append(eisen.cylinder(f'hub{s}', 0.03, 0.03, (s * 0.495, y, 0.07), m.bright, segments=10, rot=(0, math.pi / 2, 0)))
    return eisen.parent_all(o, 'cap')
