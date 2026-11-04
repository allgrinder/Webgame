"""Bodendecals (flach, über dem Boden, unter Gebäuden): Erd- und Kiesflecken mit weichem Rand,
Kieselgruppen, Blütengruppen, Grasbüschel. Mit Schattenfänger (Schatten im Bild).

Bausteine aus Gartenwerk: gw_ground (Kiesel, Halme), gw_plants (Blüten, Gräser).
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

P = gw_lib.P
lin = gw_ground.lin


def node(nt, typ, **kw):
    n = nt.nodes.new(typ)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def patch_material(name, tones, seed, noise_amp=0.42):
    """Boden mit weichem, unregelmäßigem Rand: Deckkraft fällt radial ab (Objektkoordinaten, Radius 1)."""
    m, b = gw_lib._principled(name)
    nt = m.node_tree
    L = nt.links
    tc = node(nt, 'ShaderNodeTexCoord')
    sep = node(nt, 'ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Object'], sep.inputs[0])
    comb = node(nt, 'ShaderNodeCombineXYZ')
    L.new(sep.outputs['X'], comb.inputs[0])
    L.new(sep.outputs['Y'], comb.inputs[1])
    ln = node(nt, 'ShaderNodeVectorMath', operation='LENGTH')
    L.new(comb.outputs[0], ln.inputs[0])
    nz = node(nt, 'ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    nz.inputs['Scale'].default_value = 1.3
    nz.inputs['Detail'].default_value = 4
    nz.inputs[1].default_value = seed * 1.37  # W
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    # m = 1 - r + (n - 0.5) * amp
    sub = node(nt, 'ShaderNodeMath', operation='SUBTRACT')
    sub.inputs[0].default_value = 1.0
    L.new(ln.outputs['Value'], sub.inputs[1])
    off = node(nt, 'ShaderNodeMath', operation='MULTIPLY_ADD')
    L.new(nz.outputs['Fac'], off.inputs[0])
    off.inputs[1].default_value = noise_amp * 2
    off.inputs[2].default_value = -noise_amp
    add = node(nt, 'ShaderNodeMath', operation='ADD')
    L.new(sub.outputs[0], add.inputs[0])
    L.new(off.outputs[0], add.inputs[1])
    ramp = node(nt, 'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.08
    ramp.color_ramp.elements[1].position = 0.45
    L.new(add.outputs[0], ramp.inputs['Fac'])
    # Farbe
    nz2 = node(nt, 'ShaderNodeTexNoise')
    nz2.inputs['Scale'].default_value = 7
    nz2.inputs['Detail'].default_value = 6
    L.new(tc.outputs['Object'], nz2.inputs['Vector'])
    cr = node(nt, 'ShaderNodeValToRGB')
    cr.color_ramp.elements[0].color = (*lin(tones[0]), 1)
    cr.color_ramp.elements[1].color = (*lin(tones[1]), 1)
    L.new(nz2.outputs['Fac'], cr.inputs['Fac'])
    L.new(cr.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 1.0
    bump = node(nt, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.6
    L.new(nz2.outputs['Fac'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    # Transparenz
    out = nt.nodes['Material Output']
    tr = node(nt, 'ShaderNodeBsdfTransparent')
    mix = node(nt, 'ShaderNodeMixShader')
    L.new(ramp.outputs['Color'], mix.inputs['Fac'])
    L.new(tr.outputs[0], mix.inputs[1])
    L.new(b.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs['Surface'])
    m.blend_method = 'BLEND'
    return m


def disc(R, mat):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=R * 1.4)
    o = eisen.mesh_obj('patch', bm, mat)
    o.scale = (1, 1, 1)
    # Objektkoordinaten normiert auf Radius 1
    me = o.data
    for v in me.vertices:
        v.co.x /= R
        v.co.y /= R
    o.scale = (R, R, 1)
    o.location = (0, 0, 0.001)
    return o


def pebbles(n, R, rnd, tones, rmin, rmax, angular=False, flat=0.55):
    mats = [gw_ground.pmat(f'pk{i}{tones[i]}', lin(h), 0.85, 0.18, 0.3, 30) for i, h in enumerate(tones)]
    meshes = [gw_ground.pebble_mesh(f'pm{i}', 1.0, rnd, flat, 1 if angular else 2, not angular, 0.22 if angular else 0.0) for i in range(10)]
    for i in range(n):
        a = rnd.uniform(0, math.tau)
        r = R * math.sqrt(rnd.random())
        x, y = math.cos(a) * r, math.sin(a) * r
        s = rnd.uniform(rmin, rmax)
        ob = bpy.data.objects.new('p', meshes[i % len(meshes)])
        ob.scale = (s, s, s)
        ob.location = P(x, y, s * flat * rnd.uniform(0.2, 0.6))
        ob.rotation_euler = Euler((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6.28)))
        gw_lib.link(ob, outline=False)
        if not ob.data.materials:
            ob.data.materials.append(mats[0])
        ob.material_slots[0].link = 'OBJECT'
        ob.material_slots[0].material = mats[i % len(mats)]


def rim_blades(R0, R1, n, rnd, tones=('#a89a5e', '#8f8c4c', '#b7a96d', '#7c8243')):
    mats = [gw_ground.pmat(f'rb{i}', lin(h), 0.65, 0.12, 0.0, 10, 0.3, 0.6) for i, h in enumerate(tones)]
    bm = bmesh.new()
    for i in range(n):
        a = rnd.uniform(0, math.tau)
        t = rnd.random() ** 0.6
        r = R0 + (R1 - R0) * t
        x, y = math.cos(a) * r, math.sin(a) * r
        gw_ground.blade(bm, x, y, 0.0, rnd.uniform(0.08, 0.22), rnd.uniform(0, 6.28), rnd.uniform(0.3, 0.8), 0.006, i % len(mats))
    me = bpy.data.meshes.new('rim')
    bm.to_mesh(me)
    bm.free()
    o = gw_lib.link(bpy.data.objects.new('rim', me), outline=False)
    for mm in mats:
        o.data.materials.append(mm)


def finish(out, name, size):
    eisen.shadow_catcher(size * 3)
    eisen.camera(size, size)
    out.add(name, 'decals', [out.render_frame(name, 0)], (0.5, 0.5))


def render(out):
    # Erdflecken (offener Boden) und Kiesflecken, zwei Größen
    patches = [
        ('dirt', 1.5, ('#5a4632', '#6e5a40'), ('#6e604a', '#857660', '#5a4c3a'), 260),
        ('dirt', 2.4, ('#57442f', '#6b583f'), ('#6e604a', '#857660', '#5a4c3a'), 520),
        ('gravel', 1.4, ('#6d6656', '#7c7462'), ('#9a9282', '#827a6a', '#aaa293', '#6f685b'), 900),
        ('gravel', 2.2, ('#6a6353', '#7a725f'), ('#9a9282', '#827a6a', '#aaa293', '#6f685b'), 1800),
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
