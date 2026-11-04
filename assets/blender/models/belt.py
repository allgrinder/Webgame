"""Förderband: gerade (s), Linkskurve (l), Rechtskurve (r) × 4 Richtungen × 16 Frames.

Die Rillen haben 0,5 Felder Abstand und verschieben sich pro Frame um 1/32 Feld (= 8 Positionen,
die Itemgeschwindigkeit pro Tick). 16 Frames ergeben eine nahtlose Schleife.
"""
import math

import bmesh
import bpy
import eisen

FRAMES = 16
WIDTH = 0.80     # Gurtbreite
RAIL_IN = 0.40   # Innenkante Seitenwange
RAIL_OUT = 0.48  # Außenkante
RAIL_H = 0.11
BELT_Z = 0.045
SEG = 20


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
    mat = bpy.data.materials.new(f'belt{frame}')
    mat.use_nodes = True
    nt = mat.node_tree
    n = nt.nodes
    L = nt.links
    b = n['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.8
    uv = n.new('ShaderNodeUVMap')
    sep = n.new('ShaderNodeSeparateXYZ')
    L.new(uv.outputs['UV'], sep.inputs[0])
    # phase = 2 * (v - frame/32)
    ph = n.new('ShaderNodeMath')
    ph.operation = 'MULTIPLY_ADD'
    ph.inputs[1].default_value = 2.0
    ph.inputs[2].default_value = -2.0 * frame / 32.0
    L.new(sep.outputs['Y'], ph.inputs[0])
    fr = n.new('ShaderNodeMath')
    fr.operation = 'FRACT'
    L.new(ph.outputs[0], fr.inputs[0])
    # Rille: schmaler Grat
    ramp = n.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.interpolation = 'EASE'
    cr.elements[0].position = 0.0
    cr.elements[0].color = (1, 1, 1, 1)
    cr.elements[1].position = 0.14
    cr.elements[1].color = (0, 0, 0, 1)
    e2 = cr.elements.new(0.86)
    e2.color = (0, 0, 0, 1)
    e3 = cr.elements.new(1.0)
    e3.color = (1, 1, 1, 1)
    L.new(fr.outputs[0], ramp.inputs['Fac'])
    # Gummi-Rauschen (mitbewegt)
    comb = n.new('ShaderNodeCombineXYZ')
    L.new(sep.outputs['X'], comb.inputs[0])
    vy = n.new('ShaderNodeMath')
    vy.operation = 'ADD'
    vy.inputs[1].default_value = -frame / 32.0
    L.new(sep.outputs['Y'], vy.inputs[0])
    L.new(vy.outputs[0], comb.inputs[1])
    nz = n.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 1.0
    nz.inputs['Detail'].default_value = 3
    mapping = n.new('ShaderNodeVectorMath')
    mapping.operation = 'MULTIPLY'
    mapping.inputs[1].default_value = (6.0, 32.0, 1.0)
    L.new(comb.outputs[0], mapping.inputs[0])
    L.new(mapping.outputs[0], nz.inputs['Vector'])
    mix = n.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    L.new(ramp.outputs['Color'], mix.inputs['Factor'])
    mix.inputs[6].default_value = (*eisen.srgb('#2f2c27'), 1)
    mix.inputs[7].default_value = (*eisen.srgb('#5d574a'), 1)
    m2 = n.new('ShaderNodeMix')
    m2.data_type = 'RGBA'
    m2.blend_type = 'OVERLAY'
    m2.inputs['Factor'].default_value = 0.35
    L.new(mix.outputs[2], m2.inputs[6])
    L.new(nz.outputs['Color'], m2.inputs[7])
    L.new(m2.outputs[2], b.inputs['Base Color'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.6
    bump.inputs['Distance'].default_value = 0.03
    L.new(ramp.outputs['Color'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def render(out):
    rail_mat = None
    for shape in ('s', 'l', 'r'):
        for d in range(4):
            frames = []
            for f in range(FRAMES):
                eisen.reset(samples=40)
                rail_mat = eisen.material('rail', eisen.srgb('#7d6a45'), rough=0.55, metal=0.6, noise=0.25,
                                          noise_scale=14, wear=0.6, rust=0.35)
                lip_mat = eisen.material('lip', eisen.srgb('#3b3833'), rough=0.5, metal=0.8, noise=0.2, wear=0.8)
                bed = eisen.material('bed', eisen.srgb('#1b1a18'), rough=0.9)
                objs = [
                    strip('belt', shape, -WIDTH / 2, WIDTH / 2, 0.0, BELT_Z, belt_material(f), walls=False),
                    strip('bed', shape, -RAIL_IN, RAIL_IN, -0.01, BELT_Z - 0.005, bed, walls=True),
                    strip('railL', shape, -RAIL_OUT, -RAIL_IN, 0.0, RAIL_H, rail_mat),
                    strip('railR', shape, RAIL_IN, RAIL_OUT, 0.0, RAIL_H, rail_mat),
                    strip('lipL', shape, -RAIL_OUT - 0.005, -RAIL_IN + 0.01, RAIL_H, RAIL_H + 0.012, lip_mat, walls=False),
                    strip('lipR', shape, RAIL_IN - 0.01, RAIL_OUT + 0.005, RAIL_H, RAIL_H + 0.012, lip_mat, walls=False),
                ]
                root = eisen.parent_all(objs)
                root.rotation_euler = (0, 0, -d * math.pi / 2)
                eisen.camera(1, 1)
                frames.append(out.render_frame(f'belt.{shape}.{d}', f))
            out.add(f'belt.{shape}.{d}', 'belts', frames, (0.5, 0.5), fps=60)
