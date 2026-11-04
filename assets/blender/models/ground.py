"""Boden: eine durchgehende, periodische Fläche von 8×8 Feldern, in 64 Kacheln geschnitten.

Alle Texturen sind über einen 4D-Torus mit Periode 8 Felder abgebildet. Kachel ground.X.Y gehört
an Spielposition (x mod 8, y mod 8); damit sind alle Nachbarn exakt nahtlos und das Muster
wiederholt sich erst nach 8 Feldern.
"""
import bmesh
import bpy
import eisen
import seamless

PERIOD = 8


def math_node(nt, op, a=None, b=None, vb=0.0):
    m = nt.nodes.new('ShaderNodeMath')
    m.operation = op
    if a is not None:
        nt.links.new(a, m.inputs[0])
    if b is not None:
        nt.links.new(b, m.inputs[1])
    else:
        m.inputs[1].default_value = vb
    return m.outputs[0]


def ground_material():
    mat = bpy.data.materials.new('ground')
    mat.use_nodes = True
    nt = mat.node_tree
    n = nt.nodes
    L = nt.links
    b = n['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.95
    P = PERIOD
    # Großflächige Flecken (wenige pro Periode)
    big = seamless.noise4(nt, 1.0, (1.3, 2.1, 0.7, 3.3), detail=4, roughness=0.55, scale=1.4, period=P)
    ramp = n.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.elements[0].position = 0.3
    cr.elements[0].color = (*eisen.srgb('#463e2f'), 1)
    cr.elements[1].position = 0.72
    cr.elements[1].color = (*eisen.srgb('#6a5d44'), 1)
    mid = cr.elements.new(0.52)
    mid.color = (*eisen.srgb('#574d39'), 1)
    L.new(big.outputs['Fac'], ramp.inputs['Fac'])
    col = ramp.outputs['Color']
    # mittlere Struktur (Helligkeit)
    medium = seamless.noise4(nt, 4.0, (5.1, 1.7, 2.2, 0.4), detail=6, roughness=0.6, scale=1.5, period=P)
    k = math_node(nt, 'SUBTRACT', medium.outputs['Fac'], vb=0.5)
    k = math_node(nt, 'MULTIPLY_ADD', k, vb=0.9)
    k.node.inputs[2].default_value = 1.0
    sc = n.new('ShaderNodeVectorMath')
    sc.operation = 'SCALE'
    L.new(col, sc.inputs[0])
    L.new(k, sc.inputs['Scale'])
    col = sc.outputs[0]
    # Kiesel
    vo = seamless.voronoi4(nt, 7.0, (3.3, 0.2, 1.9, 4.4), scale=1.6, period=P)
    pr = n.new('ShaderNodeValToRGB')
    pr.color_ramp.elements[0].position = 0.0
    pr.color_ramp.elements[0].color = (1, 1, 1, 1)
    pr.color_ramp.elements[1].position = 0.10
    pr.color_ramp.elements[1].color = (0, 0, 0, 1)
    L.new(vo.outputs['Distance'], pr.inputs['Fac'])
    sel = n.new('ShaderNodeTexWhiteNoise')
    sel.noise_dimensions = '4D'
    L.new(vo.outputs['Position'], sel.inputs['Vector'])
    L.new(vo.outputs['W'], sel.inputs['W'])
    keep = math_node(nt, 'GREATER_THAN', sel.outputs['Value'], vb=0.5)
    peb = math_node(nt, 'MULTIPLY', pr.outputs['Color'], keep)
    pm = n.new('ShaderNodeMix')
    pm.data_type = 'RGBA'
    L.new(peb, pm.inputs['Factor'])
    L.new(col, pm.inputs[6])
    pm.inputs[7].default_value = (*eisen.srgb('#83765d'), 1)
    L.new(pm.outputs[2], b.inputs['Base Color'])
    # Relief
    grain = seamless.noise4(nt, 14.0, (0.5, 0.5, 0.5, 0.5), detail=3, roughness=0.6, scale=1.2, period=P)
    h = math_node(nt, 'ADD', peb, grain.outputs['Fac'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.3
    bump.inputs['Distance'].default_value = 0.02
    L.new(h, bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def render(out):
    eisen.reset(samples=32)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=PERIOD + 1)
    eisen.mesh_obj('ground', bm, ground_material())
    for gy in range(PERIOD):
        for gx in range(PERIOD):
            # Spielfeld (gx, gy) liegt in Blender bei (gx, -gy)
            eisen.camera(1, 1, target=(gx, -gy, 0))
            name = f'ground.{gx}.{gy}'
            p = out.render_frame(name, 0)
            out.add(name, 'terrain', [p], (0.5, 0.5))
