"""Nahtlose Prozedur-Texturen: Feldkoordinaten (Periode 1) werden auf einen 4D-Torus abgebildet."""
import math


def torus(nt, radius, offset=(0.0, 0.0, 0.0, 0.0), period=1.0):
    """Gibt (vector_socket, w_socket) zurück. Objektkoordinaten x,y mit Periode `period`."""
    n = nt.nodes
    L = nt.links
    tc = n.new('ShaderNodeTexCoord')
    sep = n.new('ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Object'], sep.inputs[0])

    def scaled(sock):
        m = n.new('ShaderNodeMath')
        m.operation = 'MULTIPLY'
        m.inputs[1].default_value = 2 * math.pi / period
        L.new(sock, m.inputs[0])
        return m.outputs[0]

    au = scaled(sep.outputs['X'])
    av = scaled(sep.outputs['Y'])

    def trig(sock, op, add):
        m = n.new('ShaderNodeMath')
        m.operation = op
        L.new(sock, m.inputs[0])
        r = n.new('ShaderNodeMath')
        r.operation = 'MULTIPLY_ADD'
        r.inputs[1].default_value = radius
        r.inputs[2].default_value = add
        L.new(m.outputs[0], r.inputs[0])
        return r.outputs[0]

    x = trig(au, 'COSINE', offset[0])
    y = trig(au, 'SINE', offset[1])
    z = trig(av, 'COSINE', offset[2])
    w = trig(av, 'SINE', offset[3])
    comb = n.new('ShaderNodeCombineXYZ')
    L.new(x, comb.inputs[0])
    L.new(y, comb.inputs[1])
    L.new(z, comb.inputs[2])
    return comb.outputs[0], w


def noise4(nt, radius, offset=(0, 0, 0, 0), detail=4.0, roughness=0.55, scale=1.0, period=1.0):
    vec, w = torus(nt, radius, offset, period)
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = detail
    nz.inputs['Roughness'].default_value = roughness
    nt.links.new(vec, nz.inputs['Vector'])
    nt.links.new(w, nz.inputs['W'])
    return nz


def voronoi4(nt, radius, offset=(0, 0, 0, 0), scale=1.0, feature='F1', period=1.0):
    vec, w = torus(nt, radius, offset, period)
    v = nt.nodes.new('ShaderNodeTexVoronoi')
    v.voronoi_dimensions = '4D'
    v.feature = feature
    v.inputs['Scale'].default_value = scale
    nt.links.new(vec, v.inputs['Vector'])
    nt.links.new(w, v.inputs['W'])
    return v
