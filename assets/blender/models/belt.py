"""Förderband: gerade (s), Linkskurve (l), Rechtskurve (r) × 4 Richtungen × 16 Frames, dazu Umlenktrommeln
am Bandanfang und -ende.

Aufbau: U-Profil aus verwittertem, gestrichenem Stahl (Steg, Ober- und Untergurt) mit Schrauben und
Stützfüßen, darin der Gummigurt mit Querstollen, Abrieb und Staub. Stollen und Schmutz laufen mit:
Abstand 0,5 Felder, Versatz 1/32 Feld pro Frame (= 8 Positionen, die Itemgeschwindigkeit pro Tick);
der Schmutz ist in Laufrichtung periodisch (0,5 Felder), sodass 16 Frames nahtlos loopen.
"""
import math

import bauten
import bmesh
import bpy
import eisen
import gw_ground
import gw_lib
from mathutils import Vector

FRAMES = 16
WIDTH = 0.78      # Gurtbreite
RAIL_IN = 0.405   # Innenkante Profil
RAIL_OUT = 0.47   # Außenkante Profil
RAIL_H = 0.13
BELT_Z = 0.085
SEG = 20
lin = gw_ground.lin


EXT = 0.06  # Überstand über die Feldgrenze, damit der Pixelfilter keine Naht erzeugt


def path_point(shape, t, s):
    """Punkt auf dem Band (Blender-Koordinaten, Laufrichtung Nord) für Pfad t, quer s (links<0).
    Außerhalb von [0,1] wird gerade entlang der Tangente verlängert."""
    if shape == 's':
        return (s, -0.5 + t)
    if t < 0 or t > 1:
        t0 = 0.0 if t < 0 else 1.0
        x0, y0 = path_point(shape, t0, s)
        x1, y1 = path_point(shape, t0 + (0.01 if t < 0 else -0.01), s)
        dx, dy = x0 - x1, y0 - y1
        ln = math.hypot(dx, dy)
        k = abs(t - t0) * (math.pi / 4) / ln
        return (x0 + dx * k, y0 + dy * k)
    phi = t * math.pi / 2
    if shape == 'l':
        r = 0.5 + s
        return (-0.5 + r * math.sin(phi), 0.5 - r * math.cos(phi))
    r = 0.5 - s
    return (0.5 - r * math.sin(phi), 0.5 - r * math.cos(phi))


def strip(name, shape, s0, s1, z0, z1, mat, uv=False, walls=True):
    """Quaderprofil von s0..s1 (quer) und z0..z1 entlang des Pfads."""
    bm = bmesh.new()
    seg = 1 if shape == 's' else SEG
    uvl = bm.loops.layers.uv.new('UVMap')
    rows = []
    ts = [-EXT] + [i / seg for i in range(seg + 1)] + [1 + EXT]
    seg = len(ts) - 1
    for t in ts:
        row = []
        for s, z in ((s0, z1), (s1, z1), (s1, z0), (s0, z0)):
            x, y = path_point(shape, t, s)
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    faces = []
    for i in range(seg):
        a, b = rows[i], rows[i + 1]
        quads = [(0, 1)]  # Oberseite
        if walls:
            quads += [(1, 2), (3, 0)]
        for k0, k1 in quads:
            f = bm.faces.new((a[k0], a[k1], b[k1], b[k0]))
            faces.append((f, i, k0))
    bm.normal_update()
    for f, i, k0 in faces:
        for loop in f.loops:
            # u = quer (0..1), v = Pfad t
            v = loop.vert
            idx_row = None
            for r_i, row in enumerate(rows):
                if v in row:
                    idx_row = r_i
                    k = row.index(v)
                    break
            uu = 0.0 if k in (0, 3) else 1.0
            loop[uvl].uv = (uu, ts[idx_row])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = eisen.mesh_obj(name, bm, mat)
    return o


def belt_material(frame):
    """Gummigurt: Querstollen (Bump), Abrieb in der Mitte, Staub und Ölflecken, alles mitlaufend."""
    m, b = gw_lib._principled(f'belt{frame}')
    nt = m.node_tree
    L = nt.links
    N = nt.nodes
    uv = N.new('ShaderNodeUVMap')
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(uv.outputs['UV'], sep.inputs[0])
    shift = -frame / 32.0
    vv = bauten._math(nt, 'ADD', sep.outputs['Y'], vb=shift)
    # Stollen: Periode 0,5
    ph = bauten._math(nt, 'FRACT', bauten._math(nt, 'MULTIPLY', vv, vb=2.0))
    cleat = N.new('ShaderNodeValToRGB')
    cr = cleat.color_ramp
    cr.interpolation = 'EASE'
    cr.elements[0].position = 0.0
    cr.elements[0].color = (1, 1, 1, 1)
    cr.elements[1].position = 0.12
    cr.elements[1].color = (0, 0, 0, 1)
    e = cr.elements.new(0.88)
    e.color = (0, 0, 0, 1)
    e = cr.elements.new(1.0)
    e.color = (1, 1, 1, 1)
    L.new(ph, cleat.inputs['Fac'])
    # Schmutz/Abrieb: in v periodisch (Torus mit Umfang 0,5), quer u frei
    ang = bauten._math(nt, 'MULTIPLY', vv, vb=2 * math.pi * 2.0)
    c = bauten._math(nt, 'MULTIPLY', bauten._math(nt, 'COSINE', ang), vb=1.6)
    sn = bauten._math(nt, 'MULTIPLY', bauten._math(nt, 'SINE', ang), vb=1.6)
    comb = N.new('ShaderNodeCombineXYZ')
    L.new(bauten._math(nt, 'MULTIPLY', sep.outputs['X'], vb=3.0), comb.inputs[0])
    L.new(c, comb.inputs[1])
    L.new(sn, comb.inputs[2])
    dirt = bauten._noise(nt, comb.outputs[0], 2.2, 6, 0.6)
    fine = bauten._noise(nt, comb.outputs[0], 9.0, 4, 0.6)
    # Abrieb: Mitte heller und glatter
    mid = bauten._math(nt, 'ABSOLUTE', bauten._math(nt, 'SUBTRACT', sep.outputs['X'], vb=0.5))
    wear = bauten._math(nt, 'SUBTRACT', va=1.0, b=bauten._band(nt, mid, 0.1, 0.38))
    col = bauten._mix(nt, bauten._band(nt, fine, 0.3, 0.7), lin('#24221f'), lin('#2f2c28'))
    col = bauten._mix(nt, bauten._math(nt, 'MULTIPLY', wear, vb=0.35), col, lin('#3b3832'))
    col = bauten._mix(nt, bauten._math(nt, 'MULTIPLY', bauten._band(nt, dirt, 0.55, 0.8), vb=0.55), col, lin('#6b5c47'))
    col = bauten._mix(nt, bauten._math(nt, 'MULTIPLY', cleat.outputs['Color'], vb=0.75), col, lin('#575249'))
    L.new(col, b.inputs['Base Color'])
    L.new(bauten._math(nt, 'SUBTRACT', va=0.88, b=bauten._math(nt, 'MULTIPLY', wear, vb=0.2)), b.inputs['Roughness'])
    bump = N.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 1.0
    bump.inputs['Distance'].default_value = 0.02
    hgt = bauten._math(nt, 'ADD', cleat.outputs['Color'], bauten._math(nt, 'MULTIPLY', fine, vb=0.2))
    L.new(hgt, bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    gw_lib._ao(m, 0.6, 0.05)
    return m


def frame_parts(shape, m, paint='#57482b'):
    """U-Profil links und rechts, Schrauben am Steg, Stützfüße."""
    objs = []
    m.paint = bauten.weathered('w_beltpaint', paint, metal=0.3, rough=0.6, rust=0.45, dust=0.08, edge=0.6, streaks=0.4, dust_hex='#6e624e')
    m.steel = bauten.weathered('w_beltsteel', '#3a3a36', metal=0.65, rough=0.55, rust=0.35, dust=0.2, edge=0.5)
    for side in (-1, 1):
        a, b = sorted((side * RAIL_IN, side * RAIL_OUT))
        web0, web1 = sorted((side * (RAIL_OUT - 0.022), side * RAIL_OUT))
        objs.append(strip(f'web{side}', shape, web0, web1, 0.0, RAIL_H, m.steel))
        objs.append(strip(f'top{side}', shape, a, b, RAIL_H - 0.02, RAIL_H, m.paint))
        objs.append(strip(f'bot{side}', shape, a, b, 0.0, 0.018, m.steel))
        # Schrauben außen am Steg (t = 0,25 und 0,75 → nahtlos)
        for t in (0.25, 0.75):
            p = Vector((*path_point(shape, t, side * (RAIL_OUT + 0.004)), RAIL_H * 0.55))
            q = Vector((*path_point(shape, t, side * (RAIL_OUT - 0.1)), RAIL_H * 0.55))
            o = bauten.pipe(f'bolt{side}{t}', p, p + (p - q).normalized() * 0.012, 0.014, m.bright, seg=6)
            objs.append(o)
        # Stützfuß in der Feldmitte
        p = Vector((*path_point(shape, 0.5, side * (RAIL_OUT + 0.012)), 0.0))
        objs.append(eisen.box(f'foot{side}', (0.05, 0.05, RAIL_H * 0.8), (p.x, p.y, RAIL_H * 0.4), m.dark, bevel=0.006))
        objs.append(eisen.box(f'footplate{side}', (0.08, 0.08, 0.012), (p.x, p.y, 0.006), m.dark))
    # dunkles Bett unter dem Gurt
    bed = gw_ground.pmat('bed', lin('#141311'), 1.0, 0.1, 0.0, 20)
    objs.append(strip('bed', shape, -RAIL_IN, RAIL_IN, 0.018, BELT_Z - 0.01, bed))
    return objs


# Bandstufen: Sprite-Präfix, Profilfarbe, Farbe der Umlenktrommel-Lagerböcke
TIERS = (('belt', '#57482b', None), ('fast-belt', '#6a3324', '#7a3a28'), ('express-belt', '#2f4a66', '#3a5a7c'))


def render(out):
    for prefix, paint, cap_paint in TIERS:
        for shape in ('s', 'l', 'r'):
            for d in range(4):
                frames = []
                for f in range(FRAMES):
                    eisen.reset(samples=48)
                    m = bauten.Mats()
                    objs = [strip('belt', shape, -WIDTH / 2, WIDTH / 2, BELT_Z - 0.012, BELT_Z, belt_material(f), walls=False)]
                    objs += frame_parts(shape, m, paint)
                    root = eisen.parent_all(objs)
                    root.rotation_euler = (0, 0, -d * math.pi / 2)
                    eisen.camera(1, 1)
                    frames.append(out.render_frame(f'{prefix}.{shape}.{d}', f))
                out.add(f'{prefix}.{shape}.{d}', 'belts', frames, (0.5, 0.5), fps=60)
        # Umlenktrommeln an Bandende und -anfang (nur gerade Bänder)
        for kind in ('end', 'start'):
            for d in range(4):
                eisen.reset(samples=48)
                m = bauten.Mats()
                if cap_paint:
                    m.paint = bauten.weathered('w_cappaint', cap_paint, metal=0.2, rough=0.6, rust=0.4, dust=0.6, edge=0.7, streaks=0.5)
                root = bauten.belt_cap(m, end=kind == 'end')
                root.rotation_euler = (0, 0, -d * math.pi / 2)
                eisen.camera(1.25, 1.25)
                name = f'{prefix}.cap.{kind}.{d}'
                out.add(name, 'belts', [out.render_frame(name, 0)], (0.5, 0.5))
