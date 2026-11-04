"""Effekt-Sprites: Rauchwolken (Volumen), Staubwolken und Funken. Im Spiel als Partikel bewegt und ausgeblendet."""
import math
import random

import bmesh
import bpy
import eisen

CANVAS = (0.75, 0.75)


def puff(name, seed, color, density, radius=0.26):
    """Unregelmäßige Volumenwolke: Kugel mit Rausch-Dichte, die zum Rand weich ausläuft."""
    rnd = random.Random(seed)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=radius)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    eisen.link(ob)
    ob.location = (0, 0, 0.3)
    ob.scale = (rnd.uniform(0.9, 1.15), rnd.uniform(0.9, 1.15), rnd.uniform(0.8, 1.0))
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (*color, 1)
    vol.inputs['Anisotropy'].default_value = 0.35
    # leichtes Eigenleuchten hellt die Eigenschatten auf (Rauch wirkt sonst fleckig)
    vol.inputs['Emission Strength'].default_value = 0.25
    vol.inputs['Emission Color'].default_value = (*color, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.2
    noise.inputs['Detail'].default_value = 6
    noise.inputs['Roughness'].default_value = 0.6
    if 'W' in noise.inputs:
        noise.noise_dimensions = '4D'
        noise.inputs['W'].default_value = seed * 1.37
    # Abstand zur Mitte für weichen Rand
    length = nt.nodes.new('ShaderNodeVectorMath')
    length.operation = 'LENGTH'
    nt.links.new(tc.outputs['Object'], length.inputs[0])
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Location'].default_value = (rnd.uniform(-50, 50), rnd.uniform(-50, 50), rnd.uniform(-50, 50))
    mp.inputs['Rotation'].default_value = (rnd.uniform(0, 6.3), rnd.uniform(0, 6.3), rnd.uniform(0, 6.3))
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])
    fall = nt.nodes.new('ShaderNodeMapRange')
    fall.inputs['From Min'].default_value = radius * 0.35
    fall.inputs['From Max'].default_value = radius
    fall.inputs['To Min'].default_value = 1.0
    fall.inputs['To Max'].default_value = 0.0
    nt.links.new(length.outputs['Value'], fall.inputs['Value'])
    cut = nt.nodes.new('ShaderNodeMapRange')
    cut.inputs['From Min'].default_value = 0.36
    cut.inputs['From Max'].default_value = 0.7
    nt.links.new(noise.outputs['Fac'], cut.inputs['Value'])
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    nt.links.new(cut.outputs['Result'], mul.inputs[0])
    nt.links.new(fall.outputs['Result'], mul.inputs[1])
    mul2 = nt.nodes.new('ShaderNodeMath')
    mul2.operation = 'MULTIPLY'
    mul2.inputs[1].default_value = density
    nt.links.new(mul.outputs[0], mul2.inputs[0])
    nt.links.new(mul2.outputs[0], vol.inputs['Density'])
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    me.materials.append(mat)
    return ob


def render(out):
    for i in range(6):
        s = eisen.reset(samples=48, ground=False)
        s.cycles.volume_bounces = 2
        puff(f'smoke{i}', 11 + i * 7, (0.8, 0.78, 0.76), 5.0)
        eisen.camera(*CANVAS, target=(0, 0, 0.3))
        name = f'fx.smoke.{i}'
        out.add(name, 'effects', [out.render_frame(name, 0)], (0.5, 0.5))
    for i in range(4):
        s = eisen.reset(samples=48, ground=False)
        s.cycles.volume_bounces = 1
        puff(f'dust{i}', 101 + i * 13, (0.58, 0.48, 0.36), 4.5, radius=0.22)
        eisen.camera(*CANVAS, target=(0, 0, 0.3))
        name = f'fx.dust.{i}'
        out.add(name, 'effects', [out.render_frame(name, 0)], (0.5, 0.5))
    # Funke: kleiner glühender Kern mit Hof
    eisen.reset(samples=32, ground=False)
    core = eisen.cylinder('spark', 0.035, 0.035, (0, 0, 0.3), eisen.emission_material('spark', (1.0, 0.45, 0.1), 4.0), segments=12, bevel=0.017)
    halo = puff('halo', 3, (1.0, 0.5, 0.15), 1.5, radius=0.12)
    em = halo.data.materials[0].node_tree.nodes.get('Principled Volume')
    em.inputs['Emission Strength'].default_value = 3.0
    em.inputs['Emission Color'].default_value = (1.0, 0.45, 0.12, 1)
    core  # noqa: B018
    eisen.camera(0.375, 0.375, target=(0, 0, 0.3))
    out.add('fx.spark', 'effects', [out.render_frame('fx.spark', 0)], (0.5, 0.5), meta={'blend': 'add'})
    math  # noqa: B018
