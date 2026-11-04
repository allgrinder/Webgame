"""Statussymbole: kein Brennstoff, Ausgabe blockiert (flach, von oben)."""
import math

import bmesh
import eisen


def flat(name, pts, z, mat, depth=0.04):
    bm = bmesh.new()
    top = [bm.verts.new((x, y, z + depth)) for x, y in pts]
    bot = [bm.verts.new((x, y, z)) for x, y in pts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return eisen.mesh_obj(name, bm, mat)


def circle(r, n=40, cx=0.0, cy=0.0):
    return [(cx + math.cos(i / n * math.tau) * r, cy + math.sin(i / n * math.tau) * r) for i in range(n)]


def render(out):
    S = eisen.srgb
    red = eisen.emission_material('red', S('#c8432c'), 1.0)
    yellow = eisen.emission_material('yel', S('#e8b437'), 1.0)
    dark = eisen.emission_material('dk', S('#2a1a10'), 1.0)

    eisen.reset(samples=24)
    red = eisen.emission_material('red', S('#c8432c'), 1.0)
    yellow = eisen.emission_material('yel', S('#e8b437'), 1.0)
    dark = eisen.emission_material('dk', S('#2a1a10'), 1.0)
    tri = [(0, 0.44), (0.42, -0.34), (-0.42, -0.34)]
    flat('tri', tri, 0, red)
    flat('tri2', [(0, 0.33), (0.33, -0.28), (-0.33, -0.28)], 0.04, yellow)
    # Flammensymbol
    flame = [(0, 0.18), (0.08, 0.04), (0.11, -0.08), (0.06, -0.2), (-0.06, -0.2), (-0.11, -0.08), (-0.04, 0.0), (-0.02, 0.1)]
    flat('flame', flame, 0.08, dark)
    eisen.camera(1, 1, tilt=0.0)
    out.add('icon.nofuel', 'items', [out.render_frame('icon.nofuel', 0)], (0.5, 0.5))

    eisen.reset(samples=24)
    red = eisen.emission_material('red', S('#c8432c'), 1.0)
    yellow = eisen.emission_material('yel', S('#e8b437'), 1.0)
    dark = eisen.emission_material('dk', S('#2a1a10'), 1.0)
    flat('disc', circle(0.42), 0, red)
    flat('disc2', circle(0.33), 0.04, yellow)
    flat('bar', [(-0.22, -0.06), (0.22, -0.06), (0.22, 0.06), (-0.22, 0.06)], 0.08, dark)
    eisen.camera(1, 1, tilt=0.0)
    out.add('icon.blocked', 'items', [out.render_frame('icon.blocked', 0)], (0.5, 0.5))
