"""Wolkenschatten: Volumenwolken über einem Schattenfänger, gerendert wird nur der weiche Schatten.

Das Spiel lässt die Schatten langsam mit dem Wind über die Landschaft ziehen. Bildgröße 20 × 20 Felder
in 1/10 Auflösung (weich genug, im Spiel ×10 skaliert).
"""
import math
import random

import bmesh
import bpy
import eisen
from mathutils import Vector

SIZE = 20.0
HEIGHT = 4.0
PCT = 10


def cloud(seed):
    rnd = random.Random(seed)
    me = bpy.data.meshes.new('cloud')
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('cloud', me)
    eisen.link(ob)
    ob.scale = (rnd.uniform(7.5, 9.0), rnd.uniform(5.0, 7.0), 1.6)
    ob.rotation_euler = (0, 0, rnd.uniform(0, math.pi))
    mat = bpy.data.materials.new('cloud')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Location'].default_value = (rnd.uniform(-40, 40), rnd.uniform(-40, 40), rnd.uniform(-40, 40))
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.15
    noise.inputs['Detail'].default_value = 5
    noise.inputs['Roughness'].default_value = 0.55
    nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])
    length = nt.nodes.new('ShaderNodeVectorMath')
    length.operation = 'LENGTH'
    nt.links.new(tc.outputs['Object'], length.inputs[0])
    fall = nt.nodes.new('ShaderNodeMapRange')
    fall.inputs['From Min'].default_value = 0.25
    fall.inputs['From Max'].default_value = 1.0
    fall.inputs['To Min'].default_value = 1.0
    fall.inputs['To Max'].default_value = 0.0
    nt.links.new(length.outputs['Value'], fall.inputs['Value'])
    cut = nt.nodes.new('ShaderNodeMapRange')
    cut.inputs['From Min'].default_value = 0.35
    cut.inputs['From Max'].default_value = 0.75
    nt.links.new(noise.outputs['Fac'], cut.inputs['Value'])
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    nt.links.new(cut.outputs['Result'], mul.inputs[0])
    nt.links.new(fall.outputs['Result'], mul.inputs[1])
    dens = nt.nodes.new('ShaderNodeMath')
    dens.operation = 'MULTIPLY'
    dens.inputs[1].default_value = 1.4
    nt.links.new(mul.outputs[0], dens.inputs[0])
    nt.links.new(dens.outputs[0], vol.inputs['Density'])
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    me.materials.append(mat)
    return ob


def render(out):
    for i in range(4):
        s = eisen.reset(samples=64, ground=False)
        s.cycles.volume_bounces = 0
        sun = bpy.data.objects.get('sun')
        # Wolke gegen die Sonnenrichtung versetzen, damit ihr Schatten in der Bildmitte liegt
        to_sun = (sun.rotation_euler.to_matrix() @ Vector((0, 0, 1))).normalized() if sun else Vector((0, 0, 1))
        off = to_sun * (HEIGHT / max(0.2, to_sun.z))
        ob = cloud(500 + i * 17)
        ob.location = (off.x, off.y, HEIGHT)
        _low_res_shadow_render(out, f'fx.cloud.{i}', (SIZE, SIZE))


def _low_res_shadow_render(out, sprite, canvas):
    """Wie eisen.shadow_render, aber in 1/PCT Auflösung (Meta-Skalierung für das Spiel)."""
    objs = eisen.all_mesh_objects()
    eisen.set_camera_visible(objs, False)
    catcher = eisen.shadow_catcher(60)
    eisen.camera(canvas[0], canvas[1], (0.5, 0.5))
    bpy.context.scene.render.resolution_percentage = PCT
    p = out.render_frame(sprite, 0)
    out.add(sprite, 'clouds', [p], (0.5, 0.5), meta={'scale': 100 // PCT})
    bpy.data.objects.remove(catcher)
    bpy.context.scene.render.resolution_percentage = 100
    return p
