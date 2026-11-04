"""Gemeinsame Natur-Bausteine für Decals und Erzfelder: weiche Bodenflecken, Kiesel, Halme.
Baut auf den Gartenwerk-Generatoren auf (gw_ground, gw_lib)."""
import math

import bmesh
import bpy
import eisen
import gw_ground
import gw_lib
from mathutils import Euler

P = gw_lib.P
lin = gw_ground.lin


def node(nt, typ, **kw):
    n = nt.nodes.new(typ)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def patch_material(name, tones, seed, noise_amp=0.42, opacity=1.0, bump=0.6):
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
    bump.inputs['Strength'].default_value = bump
    L.new(nz2.outputs['Fac'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    # Transparenz
    out = nt.nodes['Material Output']
    tr = node(nt, 'ShaderNodeBsdfTransparent')
    mix = node(nt, 'ShaderNodeMixShader')
    op = node(nt, 'ShaderNodeMath', operation='MULTIPLY')
    L.new(ramp.outputs['Color'], op.inputs[0])
    op.inputs[1].default_value = opacity
    L.new(op.outputs[0], mix.inputs['Fac'])
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


