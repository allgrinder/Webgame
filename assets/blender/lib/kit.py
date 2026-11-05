"""Detail-Baukasten und Stufen-Materialien für den Stil „Endzeit-Industrie“ (siehe docs/ART_STYLE.md).

Drei Ausbaustufen, die man an den Gebäuden ablesen kann:
  1 Notbau     – aus Schrott zusammengeschweißt: Flickenbleche in verschiedenen Farben, Wellblech, Plane, Rost.
  2 Werkstatt  – genormte, lackierte Paneele mit Fugen, Nieten, Warnstreifen, Geländer, Lüftungsgitter.
  3 Hochtechnik – glatte Verbundpaneele (Graphit/Hellgrau), feine Fugen, Leuchtstreifen, kaum Verschleiß.

Alle Teile liefern Blender-Objekte (oder hängen sie an eine Liste an); Maße in Feldern (1 = 1 Feld).
Lesbarkeit im Spiel: 1 Feld = 128 px (HD) bzw. 64 px (SD); Details unter ~0.03 verschwinden in SD.
"""
import math
import random

import bauten
import bmesh
import bpy
import eisen
import gw_ground
from bauten import _band, _math, _mix, _n, _noise, beam
from mathutils import Vector

lin = gw_ground.lin


# --------------------------------------------------------------------------- Materialien

def hazard(name='k_hazard', a='#c99a2e', b='#1e1d1b', scale=9.0, wear=0.5):
    """Diagonale Warnstreifen (gelb/schwarz), abgewetzt."""
    m = bauten.weathered(name, a, metal=0.2, rough=0.6, rust=0.25 * wear, dust=0.4, edge=0.6 * wear, streaks=0.2)
    nt = m.node_tree
    b_ = nt.nodes['Principled BSDF']
    src = b_.inputs['Base Color'].links[0].from_socket
    tc = _n(nt, 'ShaderNodeTexCoord')
    sep = _n(nt, 'ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    s = _math(nt, 'ADD', sep.outputs['X'], sep.outputs['Y'])
    s = _math(nt, 'ADD', s, sep.outputs['Z'])
    w = _math(nt, 'MULTIPLY', s, vb=scale)
    fr = _math(nt, 'FRACT', w)
    stripe = _band(nt, fr, 0.48, 0.52)
    col = _mix(nt, stripe, src, lin(b))
    nt.links.new(col, b_.inputs['Base Color'])
    return m


def shade(hex_, f):
    h = hex_.lstrip('#')
    return '#' + ''.join(f'{min(255, int(int(h[i:i + 2], 16) * f)):02x}' for i in (0, 2, 4))


def soft_ao(mat, f=0.25):
    """Umgebungsverdeckung abschwächen (Wellblech/Plane verdecken sich sonst selbst zu stark)."""
    for n in mat.node_tree.nodes:
        if n.type == 'MIX' and any(lk.from_node.type == 'AMBIENT_OCCLUSION' for i in n.inputs for lk in i.links):
            n.inputs['Factor'].default_value = f
    return mat


def glow(name, hex_, strength=4.0):
    return eisen.emission_material(name, lin(hex_), strength)


class Tier:
    """Materialsatz einer Ausbaustufe. Grundfarben bewusst gedeckt; Akzente sparsam."""

    def __init__(self, level, accent='#8a6a2c', prefix=None):
        p = prefix or f't{level}'
        W = bauten.weathered
        self.level = level
        if level == 1:
            # Schrott: viel Rost, Staub, verblichene Fremdfarben
            self.frame = W(p + 'frame', '#33302b', metal=0.6, rough=0.65, rust=0.55, dust=0.5, edge=0.4, streaks=0.5)
            self.panels = [
                W(p + 'pa', '#4f5541', metal=0.3, rough=0.6, rust=0.55, dust=0.25, edge=0.6, streaks=0.6),
                W(p + 'pb', '#5e3b28', metal=0.25, rough=0.7, rust=0.7, dust=0.25, edge=0.4, streaks=0.5),
                W(p + 'pc', '#414c4e', metal=0.35, rough=0.55, rust=0.45, dust=0.25, edge=0.6, streaks=0.5),
                W(p + 'pd', accent, metal=0.25, rough=0.6, rust=0.55, dust=0.25, edge=0.8, streaks=0.6),
            ]
            self.metal = W(p + 'metal', '#585750', metal=0.75, rough=0.5, rust=0.5, dust=0.45, edge=0.5)
            self.accent = self.panels[3]
            self.tarp = soft_ao(W(p + 'tarp', '#6d6845', metal=0.0, rough=0.95, rust=0.0, dust=0.3, edge=0.0, grime=0.3, streaks=0.3))
            self.corr = soft_ao(W(p + 'corr', '#5d6466', metal=0.3, rough=0.5, rust=0.6, dust=0.2, edge=0.5, streaks=0.7))
            self.wood = gw_ground.pmat(p + 'wood', lin('#5a4630'), 0.9, 0.35, 0.5, 30)
        elif level == 2:
            self.frame = W(p + 'frame', '#2f302d', metal=0.6, rough=0.55, rust=0.3, dust=0.45, edge=0.45)
            # Anstrich in der Akzentfarbe (Dach trägt die Erkennungsfarbe), zwei leicht verschiedene Chargen
            body = W(p + 'body', accent, metal=0.35, rough=0.5, rust=0.25, dust=0.22, edge=0.6, streaks=0.35)
            self.panels = [body, W(p + 'body2', shade(accent, 0.88), metal=0.35, rough=0.5, rust=0.25, dust=0.22, edge=0.6, streaks=0.35)]
            self.metal = W(p + 'metal', '#6c6e6c', metal=0.85, rough=0.38, rust=0.15, dust=0.3, edge=0.4)
            self.accent = W(p + 'acc', '#57594f', metal=0.45, rough=0.5, rust=0.25, dust=0.3, edge=0.6, streaks=0.4)
            self.tarp = None
            self.wood = None
        else:
            # Hochtechnik: kaum Rost, feiner Staub, Graphit und helle Verbundplatten
            self.frame = W(p + 'frame', '#222426', metal=0.5, rough=0.4, rust=0.0, dust=0.25, edge=0.3, grime=0.25, streaks=0.0)
            light = W(p + 'light', '#8c908b', metal=0.2, rough=0.35, rust=0.0, dust=0.1, edge=0.35, grime=0.25, streaks=0.1)
            self.panels = [light, W(p + 'graph', '#34383b', metal=0.4, rough=0.35, rust=0.0, dust=0.08, edge=0.35, grime=0.2, streaks=0.0)]
            self.metal = W(p + 'metal', '#8d9294', metal=0.9, rough=0.25, rust=0.0, dust=0.15, edge=0.3, grime=0.1, streaks=0.0)
            self.accent = W(p + 'acc', accent, metal=0.3, rough=0.4, rust=0.0, dust=0.2, edge=0.4, grime=0.2, streaks=0.0)
            self.tarp = None
            self.wood = None
        self.dark = W(p + 'dark', '#1d1d1b', metal=0.5, rough=0.6, rust=0.15 if level < 3 else 0.0, dust=0.35, edge=0.3)
        self.rubber = W(p + 'rub', '#1f1e1c', metal=0.0, rough=0.85, rust=0.0, dust=0.35, edge=0.0)
        self.hazard = hazard(p + 'haz', wear=1.0 if level == 1 else 0.6 if level == 2 else 0.2)
        self.glass = eisen.material(p + 'glass', eisen.srgb('#3d5a60' if level < 3 else '#2f5866'), rough=0.06, metal=0.3)
        self.inner = eisen.material(p + 'inner', eisen.srgb('#141413'), rough=0.9)


# --------------------------------------------------------------------------- Grundformen

def corrugated(name, w, d, waves, amp, loc, mat, rot=(0, 0, 0), axis='X'):
    """Wellblech w×d (Wellen entlang axis), flach in der XY-Ebene, Dicke = amp."""
    bm = bmesh.new()
    n = max(4, int(waves * 6))
    rows = []
    for i in range(n + 1):
        t = i / n
        z = math.sin(t * waves * math.tau) * amp * 0.5
        if axis == 'X':
            a = bm.verts.new((-w / 2 + t * w, -d / 2, z))
            b = bm.verts.new((-w / 2 + t * w, d / 2, z))
        else:
            a = bm.verts.new((-w / 2, -d / 2 + t * d, z))
            b = bm.verts.new((w / 2, -d / 2 + t * d, z))
        rows.append((a, b))
    for i in range(n):
        a0, b0 = rows[i]
        a1, b1 = rows[i + 1]
        bm.faces.new((a0, a1, b1, b0) if axis == 'X' else (a0, b0, b1, a1))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.012)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = eisen.mesh_obj(name, bm, mat, smooth=False)
    o.location = loc
    o.rotation_euler = rot
    return o


def plate(o, name, size, loc, mat, rot=(0, 0, 0), bevel=0.008):
    o.append(eisen.box(name, size, loc, mat, bevel=bevel, rot=rot))
    return o[-1]


def bolt_row(o, mat, a, b, n, r=0.018, h=0.02, axis='Z'):
    """n Schrauben gleichmäßig von a nach b (3D-Punkte)."""
    a, b = Vector(a), Vector(b)
    rot = {'Z': (0, 0, 0), 'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0)}[axis]
    for i in range(n):
        p = a.lerp(b, (i + 0.5) / n)
        o.append(eisen.cylinder(f'{name_of(o)}bolt', r, h, tuple(p), mat, segments=6, rot=rot))


def name_of(o):
    return f'k{len(o)}_'


def paneled_top(o, x0, y0, x1, y1, z, nx, ny, mats, rnd, gap=0.018, thick=0.035, jitter=0.0, bolts_mat=None, tilt=0.0):
    """Deckfläche aus nx×ny Platten mit Fugen. Mehrere Materialien → Flickenblech (zufällig je Platte).
    jitter: zufällige Höhen-/Kippabweichung (Schrott), bolts_mat: Eckschrauben je Platte."""
    w = (x1 - x0) / nx
    d = (y1 - y0) / ny
    for i in range(nx):
        for j in range(ny):
            cx = x0 + (i + 0.5) * w
            cy = y0 + (j + 0.5) * d
            mat = mats[rnd.randrange(len(mats))] if len(mats) > 1 else mats[0]
            dz = rnd.uniform(0, jitter) if jitter else 0.0
            rot = (rnd.uniform(-1, 1) * jitter * 0.6, rnd.uniform(-1, 1) * jitter * 0.6, rnd.uniform(-1, 1) * jitter * 0.15) if jitter else (tilt, 0, 0)
            sx = w - gap - (rnd.uniform(0, 0.06) if jitter else 0)
            sy = d - gap - (rnd.uniform(0, 0.06) if jitter else 0)
            plate(o, f'{name_of(o)}pl', (sx, sy, thick), (cx, cy, z + thick / 2 + dz), mat, rot=rot)
            if bolts_mat:
                for bx in (-1, 1):
                    for by in (-1, 1):
                        o.append(eisen.cylinder(f'{name_of(o)}b', 0.016, 0.018,
                                                (cx + bx * (sx / 2 - 0.04), cy + by * (sy / 2 - 0.04), z + thick + dz + 0.006),
                                                bolts_mat, segments=6))


def patch(o, rnd, mats, x, y, z, w, d, bolts_mat=None, rot_z=None):
    """Aufgeschweißter Flicken (leicht verdreht) mit Schweißnaht-Punkten."""
    mat = mats[rnd.randrange(len(mats))]
    rz = rot_z if rot_z is not None else rnd.uniform(-0.25, 0.25)
    plate(o, f'{name_of(o)}patch', (w, d, 0.015), (x, y, z + 0.008), mat, rot=(0, 0, rz), bevel=0.004)
    if bolts_mat:
        c, s = math.cos(rz), math.sin(rz)
        for bx, by in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            px, py = bx * (w / 2 - 0.03), by * (d / 2 - 0.03)
            o.append(eisen.cylinder(f'{name_of(o)}pb', 0.014, 0.014, (x + c * px - s * py, y + s * px + c * py, z + 0.02),
                                    bolts_mat, segments=6))


def grille(o, name, w, d, loc, frame_mat, slat_mat, slats=None, h=0.06):
    """Lüftungsgitter: Rahmen mit Lamellen (quer zu w)."""
    x, y, z = loc
    n = slats or max(3, int(d / 0.05))
    o.append(eisen.box(name + 'f', (w, d, h), (x, y, z + h / 2), frame_mat, bevel=0.006))
    o.append(eisen.box(name + 'in', (w - 0.05, d - 0.05, 0.01), (x, y, z + h + 0.002), eisen.material(name + 'hole', (0.01, 0.01, 0.01), rough=1.0)))
    for k in range(n):
        yy = y - d / 2 + 0.035 + k * (d - 0.07) / max(1, n - 1)
        o.append(eisen.box(f'{name}s{k}', (w - 0.06, 0.012, 0.03), (x, yy, z + h + 0.004), slat_mat, rot=(math.radians(35), 0, 0)))


def fan(o, name, r, loc, phase, mats, blades=6):
    """Rundlüfter mit Schutzgitter: Wanne, Flügel (drehen mit phase), Gitterkreuz."""
    x, y, z = loc
    o.append(eisen.cylinder(name + 'ring', r + 0.05, 0.08, (x, y, z + 0.04), mats.frame, segments=40, bevel=0.01))
    o.append(eisen.cylinder(name + 'well', r, 0.02, (x, y, z + 0.075), mats.inner, segments=40))
    a = phase * math.tau
    for k in range(blades):
        b = a + k / blades * math.tau
        bl = beam(f'{name}bl{k}', (x, y, z + 0.09), (x + math.cos(b) * r * 0.92, y + math.sin(b) * r * 0.92, z + 0.09), (r * 0.32, 0.01), mats.metal)
        bl.rotation_euler.rotate_axis('Y', math.radians(22))
        o.append(bl)
    o.append(eisen.cylinder(name + 'hub', r * 0.18, 0.05, (x, y, z + 0.11), mats.dark, segments=16))
    for k in range(4):
        b = k / 4 * math.tau + math.pi / 4
        o.append(beam(f'{name}g{k}', (x, y, z + 0.13), (x + math.cos(b) * (r + 0.03), y + math.sin(b) * (r + 0.03), z + 0.13), (0.012, 0.012), mats.dark))
    for rr in (r * 0.45, r * 0.85):
        ring = eisen.cylinder(f'{name}gr{rr:.2f}', rr, 0.012, (x, y, z + 0.13), mats.dark, segments=32)
        m = ring.modifiers.new('wire', 'WIREFRAME')
        m.thickness = 0.01
        o.append(ring)


def railing(o, pts, h, mat, post_every=0.45, r=0.012, closed=False):
    """Geländer entlang eines Polygons (3D-Punkte am Boden), Pfosten + zwei Handläufe."""
    P = [Vector(p) for p in pts] + ([Vector(pts[0])] if closed else [])
    for i in range(len(P) - 1):
        a, b = P[i], P[i + 1]
        L = (b - a).length
        n = max(1, round(L / post_every))
        for k in range(n + (1 if i == len(P) - 2 and not closed else 0)):
            p = a.lerp(b, k / n)
            o.append(eisen.cylinder(f'{name_of(o)}post', r, h, (p.x, p.y, p.z + h / 2), mat, segments=6))
        for hh in (h * 0.55, h):
            o.append(bauten.pipe(f'{name_of(o)}rail', (a.x, a.y, a.z + hh), (b.x, b.y, b.z + hh), r, mat, 6))


def cable(o, name, pts, r, mat, sag=0.0):
    """Kabel/Schlauch als Kurve durch Punkte (optional durchhängend)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 2
    sp = cu.splines.new('BEZIER')
    P = [Vector(p) for p in pts]
    if sag and len(P) == 2:
        m = (P[0] + P[1]) / 2
        m.z -= sag
        P = [P[0], m, P[1]]
    sp.bezier_points.add(len(P) - 1)
    for bp, p in zip(sp.bezier_points, P):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(mat)
    eisen.link(ob)
    o.append(ob)
    return ob


def pipe_run(o, name, pts, r, mat, flange_mat, brackets_mat=None):
    """Rohrleitung durch Punkte mit Flanschen an den Knicken."""
    P = [Vector(p) for p in pts]
    for i in range(len(P) - 1):
        o.append(bauten.pipe(f'{name}{i}', tuple(P[i]), tuple(P[i + 1]), r, mat, 14))
    for i, p in enumerate(P):
        o.append(eisen.cylinder(f'{name}j{i}', r * 1.25, r * 2.6 if 0 < i < len(P) - 1 else 0.04, tuple(p), flange_mat, segments=14))
        if brackets_mat and 0 < i < len(P) - 1:
            pass


def ladder(o, name, x, y, z0, z1, mat, w=0.18, facing='Y'):
    for s in (-1, 1):
        dx, dy = (s * w / 2, 0) if facing == 'Y' else (0, s * w / 2)
        o.append(bauten.pipe(f'{name}r{s}', (x + dx, y + dy, z0), (x + dx, y + dy, z1), 0.012, mat, 6))
    n = int((z1 - z0) / 0.09)
    for k in range(1, n):
        zz = z0 + k * (z1 - z0) / n
        a = (x - w / 2, y, zz) if facing == 'Y' else (x, y - w / 2, zz)
        b = (x + w / 2, y, zz) if facing == 'Y' else (x, y + w / 2, zz)
        o.append(bauten.pipe(f'{name}s{k}', a, b, 0.008, mat, 6))


def beacon_light(o, name, loc, mat_glow, mats):
    x, y, z = loc
    o.append(eisen.cylinder(name + 'b', 0.045, 0.03, (x, y, z + 0.015), mats.dark, segments=10))
    o.append(eisen.cylinder(name + 'l', 0.035, 0.05, (x, y, z + 0.055), mat_glow, segments=10))


def greebles(o, rnd, x0, y0, x1, y1, z, n, mats, hmax=0.1):
    """Kleinteile (Kästen, Stutzen, Deckel) auf einer Fläche."""
    pool = [mats.dark, mats.metal, mats.frame] + mats.panels[:1]
    for k in range(n):
        x = rnd.uniform(x0, x1)
        y = rnd.uniform(y0, y1)
        t = rnd.random()
        mat = pool[rnd.randrange(len(pool))]
        if t < 0.5:
            w, d, h = rnd.uniform(0.06, 0.2), rnd.uniform(0.06, 0.16), rnd.uniform(0.02, hmax)
            plate(o, f'{name_of(o)}gb', (w, d, h), (x, y, z + h / 2), mat, rot=(0, 0, rnd.choice((0, math.pi / 2))), bevel=0.006)
        elif t < 0.8:
            r, h = rnd.uniform(0.025, 0.06), rnd.uniform(0.02, hmax)
            o.append(eisen.cylinder(f'{name_of(o)}gc', r, h, (x, y, z + h / 2), mat, segments=12, bevel=0.004))
        else:
            o.append(eisen.box(f'{name_of(o)}gl', (rnd.uniform(0.1, 0.25), 0.03, 0.03), (x, y, z + 0.015), mats.dark,
                               rot=(0, 0, rnd.choice((0, math.pi / 2)))))


def ibeam(o, name, a, b, h, w, mat):
    """Doppel-T-Träger von a nach b (horizontal), Höhe h, Breite w."""
    a, b = Vector(a), Vector(b)
    o.append(beam(name + 'w', tuple(a), tuple(b), (0.02, h), mat))
    for s in (-1, 1):
        o.append(beam(f'{name}f{s}', tuple(a + Vector((0, 0, s * h / 2))), tuple(b + Vector((0, 0, s * h / 2))), (w, 0.015), mat))


def wall_panels(o, axis, fixed, a0, a1, z0, z1, n, mats, rnd, thick=0.05, outward=1, ribs_mat=None, jitter=0.0):
    """Senkrechte Wandpaneele entlang axis ('X' = Wand parallel zu X bei y=fixed) mit Fugen und Rippen."""
    seg = (a1 - a0) / n
    for k in range(n):
        c = a0 + (k + 0.5) * seg
        mat = mats[rnd.randrange(len(mats))] if len(mats) > 1 else mats[0]
        hh = z1 - z0 - (rnd.uniform(0, 0.08) if jitter else 0)
        dz = rnd.uniform(-0.02, 0.02) if jitter else 0
        rot = (0, rnd.uniform(-jitter, jitter) * 0.2, 0) if jitter and axis == 'X' else (rnd.uniform(-jitter, jitter) * 0.2, 0, 0) if jitter else (0, 0, 0)
        if axis == 'X':
            plate(o, f'{name_of(o)}wp', (seg - 0.016, thick, hh), (c, fixed + outward * rnd.uniform(0, 0.012 if jitter else 0), z0 + hh / 2 + dz), mat, rot=rot)
        else:
            plate(o, f'{name_of(o)}wp', (thick, seg - 0.016, hh), (fixed + outward * rnd.uniform(0, 0.012 if jitter else 0), c, z0 + hh / 2 + dz), mat, rot=rot)
        if ribs_mat:
            for zz in (z0 + 0.12, z1 - 0.12):
                if axis == 'X':
                    plate(o, f'{name_of(o)}rib', (seg - 0.04, 0.02, 0.03), (c, fixed + outward * (thick / 2 + 0.01), zz), ribs_mat, bevel=0.0)
                else:
                    plate(o, f'{name_of(o)}rib', (0.02, seg - 0.04, 0.03), (fixed + outward * (thick / 2 + 0.01), c, zz), ribs_mat, bevel=0.0)


def light_strip(o, name, a, b, mat, size=(0.025, 0.025)):
    o.append(beam(name, a, b, size, mat))


def rng(seed):
    return random.Random(seed)
