"""Bauteile der Gebäude, Items und Figuren (eigene Formen). Alle Funktionen liefern ein Wurzelobjekt.

Gebäude sind für Richtung Nord modelliert (Ausgabe nach +Y) und mittig um den Ursprung gebaut.
"""
import math
import random

import bmesh
import bpy
import eisen
from mathutils import Vector


class Mats:
    """Gemeinsame Materialien (pro Szene neu anlegen)."""

    def __init__(self):
        S = eisen.srgb
        self.steel = eisen.material('steel', S('#4a4a45'), rough=0.5, metal=0.7, noise=0.25, wear=0.7, rust=0.3)
        self.dark = eisen.material('dark', S('#2c2c29'), rough=0.6, metal=0.6, noise=0.2, wear=0.6, rust=0.2)
        self.ochre = eisen.material('ochre', S('#8c6a2e'), rough=0.55, metal=0.3, noise=0.25, wear=0.8, rust=0.25)
        self.rust = eisen.material('rust', S('#6b3c1f'), rough=0.85, noise=0.3)
        self.rubber = eisen.material('rubber', S('#222120'), rough=0.85)
        self.brass = eisen.material('brass', S('#8f7440'), rough=0.4, metal=0.8, noise=0.2, wear=0.5)
        self.stone = eisen.material('stone', S('#8a7b66'), rough=0.95, noise=0.35, noise_scale=10, bump=0.4)
        self.stone_dark = eisen.material('stoned', S('#5e5446'), rough=0.95, noise=0.35, noise_scale=10, bump=0.4)
        self.soot = eisen.material('soot', S('#1b1917'), rough=0.9, noise=0.2)
        self.plate = eisen.material('plate', S('#7c8085'), rough=0.35, metal=0.9, noise=0.12, wear=0.4)
        self.cloth = eisen.material('cloth', S('#6b5a3a'), rough=0.9, noise=0.2)
        self.suit = eisen.material('suit', S('#7c4f2a'), rough=0.8, noise=0.2)
        self.skin = eisen.material('skin', S('#b48a68'), rough=0.7)
        self.visor = eisen.material('visor', S('#2c3a40'), rough=0.2, metal=0.4)


def rivets(objs, mat, pts, z, r=0.025):
    for i, (x, y) in enumerate(pts):
        objs.append(eisen.cylinder(f'rivet{i}', r, 0.02, (x, y, z), mat, segments=8))


# --------------------------------------------------------------------------- Zahnrad

def gear(name, r_outer, r_inner, teeth, depth, mat, hole=0.0):
    bm = bmesh.new()
    pts = []
    n = teeth * 4
    for i in range(n):
        a = i / n * math.tau
        k = i % 4
        r = r_outer if k in (1, 2) else r_inner
        pts.append((math.cos(a) * r, math.sin(a) * r))
    top = [bm.verts.new((x, y, depth / 2)) for x, y in pts]
    bot = [bm.verts.new((x, y, -depth / 2)) for x, y in pts]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = eisen.mesh_obj(name, bm, mat)
    if hole > 0:
        cut = eisen.cylinder(name + 'cut', hole, depth * 3, (0, 0, 0), mat, segments=16)
        m = o.modifiers.new('hole', 'BOOLEAN')
        m.object = cut
        m.operation = 'DIFFERENCE'
        bpy.context.view_layer.update()
        cut.hide_render = True
    return o


# --------------------------------------------------------------------------- Bohrer 2×2

def drill(m, phase=0.0, working=True):
    """Brennstoff-Bohrer, Ausgabe nach Norden (+Y) über der linken Hälfte."""
    o = []
    # Bodenrahmen
    o.append(eisen.box('frame', (1.86, 1.86, 0.14), (0, 0, 0.07), m.dark, bevel=0.02))
    # Gehäuse
    o.append(eisen.box('body', (1.6, 1.5, 0.62), (0, -0.08, 0.45), m.steel, bevel=0.04))
    o.append(eisen.box('band', (1.64, 1.54, 0.08), (0, -0.08, 0.62), m.ochre, bevel=0.01))
    # Feuerklappe vorne (Süden)
    o.append(eisen.box('hatch', (0.5, 0.05, 0.3), (0.35, -0.85, 0.38), m.dark, bevel=0.01))
    o.append(eisen.box('hatchglow', (0.32, 0.02, 0.06), (0.35, -0.88, 0.32), eisen.emission_material('ember', (1.0, 0.35, 0.08), 3.0 if working else 0.0)))
    # Schornstein hinten rechts
    o.append(eisen.cylinder('stack', 0.12, 0.7, (0.55, 0.35, 1.0), m.dark, segments=16))
    o.append(eisen.cylinder('stacktop', 0.15, 0.06, (0.55, 0.35, 1.36), m.rust, segments=16))
    # Ausgaberutsche nach Norden über der linken Hälfte (x = -0.35)
    o.append(eisen.box('chute', (0.42, 0.5, 0.18), (-0.35, 0.78, 0.3), m.ochre, bevel=0.02, rot=(math.radians(-18), 0, 0)))
    o.append(eisen.box('chuteIn', (0.3, 0.46, 0.06), (-0.35, 0.8, 0.38), m.soot, rot=(math.radians(-18), 0, 0)))
    # Antriebsrad oben (dreht sich)
    g = gear('gear', 0.38, 0.31, 10, 0.08, m.brass)
    g.location = (-0.25, -0.15, 0.82)
    g.rotation_euler = (0, 0, phase * math.tau / 10)
    o.append(g)
    o.append(eisen.cylinder('hub', 0.1, 0.12, (-0.25, -0.15, 0.86), m.dark, segments=12))
    # Kurbel / Pleuel
    a = phase * math.tau
    cx, cy = -0.25 + math.cos(a) * 0.2, -0.15 + math.sin(a) * 0.2
    o.append(eisen.cylinder('crank', 0.04, 0.12, (cx, cy, 0.92), m.steel, segments=8))
    bar = eisen.box('rod', (0.5, 0.06, 0.05), ((cx + 0.35) / 2, (cy - 0.1) / 2, 0.93), m.steel)
    bar.rotation_euler = (0, 0, math.atan2(-0.1 - cy, 0.35 - cx))
    o.append(bar)
    # Bohrkopf-Gehäuse rechts vorne mit Kolben
    piston = 0.06 * math.sin(a)
    o.append(eisen.box('cyl', (0.36, 0.36, 0.3), (0.42, -0.35, 0.88), m.dark, bevel=0.03))
    o.append(eisen.cylinder('piston', 0.09, 0.3, (0.42, -0.35, 1.05 + piston), m.plate, segments=12))
    rivets(o, m.dark, [(-0.75, -0.78), (0.75, -0.78), (-0.75, 0.62), (0.75, 0.62)], 0.78)
    return eisen.parent_all(o, 'drill')


# --------------------------------------------------------------------------- Steinofen 2×2

def furnace(m, fire=0.0, seed=3):
    """Gemauerter Ofen mit Feueröffnung nach Süden (zur Kamera)."""
    rnd = random.Random(seed)
    o = []
    o.append(eisen.box('base', (1.84, 1.84, 0.12), (0, 0, 0.06), m.stone_dark, bevel=0.03))
    # Mauerwerk aus Steinlagen
    layers = 4
    for k in range(layers):
        z = 0.12 + k * 0.2
        w = 1.74 - k * 0.12
        for side in range(4):
            n = 4
            for i in range(n):
                t = (i + 0.5) / n - 0.5
                L = w / n * 0.96
                if side in (0, 2):
                    x, y = t * w, (w / 2 - 0.12) * (1 if side == 0 else -1)
                    size = (L, 0.26, 0.19)
                else:
                    x, y = (w / 2 - 0.12) * (1 if side == 1 else -1), t * w
                    size = (0.26, L, 0.19)
                if side == 2 and k < 2 and abs(t) < 0.3:
                    continue  # Feueröffnung vorne
                mat = m.stone if rnd.random() > 0.3 else m.stone_dark
                b = eisen.box(f's{k}{side}{i}', size, (x, y, z + 0.1), mat, bevel=0.035)
                b.rotation_euler = (0, 0, (rnd.random() - 0.5) * 0.08)
                o.append(b)
    # Innenraum
    o.append(eisen.box('inner', (1.3, 1.3, 0.8), (0, 0, 0.5), m.soot))
    # Deckplatte mit Rauchabzug
    o.append(eisen.box('cap', (1.3, 1.3, 0.14), (0, 0.05, 0.98), m.stone_dark, bevel=0.05))
    o.append(eisen.cylinder('flue', 0.2, 0.36, (0.25, 0.25, 1.2), m.stone, segments=12, bevel=0.02))
    o.append(eisen.cylinder('flueIn', 0.13, 0.38, (0.25, 0.25, 1.22), m.soot, segments=12))
    # Feuerraum-Rahmen (Eisen)
    o.append(eisen.box('lintel', (0.8, 0.12, 0.1), (0, -0.8, 0.56), m.dark, bevel=0.01))
    fire_objs = []
    if fire > 0:
        fm = eisen.emission_material('fire', (1.0, 0.42, 0.1), 6.0 * fire)
        for i in range(5):
            r = 0.06 + rnd.random() * 0.05
            f = eisen.rock(f'fire{i}', r, (-0.2 + i * 0.1, -0.72 + rnd.random() * 0.05, 0.17 + rnd.random() * 0.06 * fire), fm, seed + i, squash=1.2 + fire, detail=1)
            fire_objs.append(f)
        coal = eisen.material('ember', (0.05, 0.02, 0.01), rough=0.9, emission=(1.0, 0.25, 0.05), emission_strength=1.0 + 2.0 * fire)
        o.append(eisen.box('embers', (0.6, 0.2, 0.06), (0, -0.7, 0.15), coal))
        light = bpy.data.lights.new('firelight', 'POINT')
        light.energy = 45 * fire
        light.color = (1.0, 0.55, 0.25)
        light.shadow_soft_size = 0.2
        lo = bpy.data.objects.new('firelight', light)
        lo.location = (0, -0.7, 0.32)
        eisen.link(lo)
    else:
        o.append(eisen.box('ash', (0.6, 0.3, 0.05), (0, -0.6, 0.14), m.soot))
    o.extend(fire_objs)
    root = eisen.parent_all(o, 'furnace')
    return root, fire_objs


# --------------------------------------------------------------------------- Greifarm

def inserter_base(m):
    o = []
    o.append(eisen.cylinder('plate', 0.36, 0.08, (0, 0, 0.04), m.dark, segments=24, bevel=0.01))
    o.append(eisen.cylinder('ring', 0.3, 0.1, (0, 0, 0.12), m.ochre, segments=24, bevel=0.01))
    o.append(eisen.cylinder('pillar', 0.14, 0.18, (0, 0, 0.26), m.steel, segments=16))
    o.append(eisen.box('fuelbox', (0.24, 0.12, 0.14), (0, -0.28, 0.12), m.dark, bevel=0.01))
    o.append(eisen.box('fuelglow', (0.12, 0.02, 0.03), (0, -0.345, 0.12), eisen.emission_material('ember', (1.0, 0.35, 0.08), 2.0)))
    rivets(o, m.steel, [(0.28, 0.12), (-0.28, 0.12), (0.22, -0.2), (-0.22, -0.2)], 0.09, 0.02)
    return eisen.parent_all(o, 'inserterBase')


def inserter_arm(m, length=1.0):
    """Arm nach Norden (+Y) vom Drehpunkt im Ursprung, Greifer am Ende."""
    o = []
    o.append(eisen.cylinder('pivot', 0.12, 0.1, (0, 0, 0.4), m.dark, segments=16))
    o.append(eisen.box('arm', (0.1, length - 0.05, 0.07), (0, (length - 0.05) / 2, 0.42), m.ochre, bevel=0.015))
    o.append(eisen.box('armB', (0.06, length * 0.6, 0.05), (0, length * 0.35, 0.47), m.steel, bevel=0.01))
    # Greifer
    o.append(eisen.box('wrist', (0.18, 0.08, 0.08), (0, length - 0.04, 0.4), m.dark, bevel=0.01))
    o.append(eisen.box('clawL', (0.04, 0.12, 0.06), (-0.07, length + 0.05, 0.38), m.steel))
    o.append(eisen.box('clawR', (0.04, 0.12, 0.06), (0.07, length + 0.05, 0.38), m.steel))
    return eisen.parent_all(o, 'inserterArm')


# --------------------------------------------------------------------------- Figur

def worker(m, phase=0.0, walking=True):
    """Arbeiter mit Helm und Rucksack, blickt nach Süden (-Y, zur Kamera)."""
    o = []
    swing = math.sin(phase * math.tau) * (0.45 if walking else 0.0)
    bob = abs(math.sin(phase * math.tau)) * (0.025 if walking else 0.0)
    for side, s in (('L', -1), ('R', 1)):
        leg = eisen.box('leg' + side, (0.1, 0.11, 0.36), (s * 0.075, 0, 0.18), m.cloth, bevel=0.02)
        leg.rotation_euler = (swing * s, 0, 0)
        o.append(leg)
        boot = eisen.box('boot' + side, (0.11, 0.16, 0.06), (s * 0.075, -0.02 - math.sin(swing * s) * 0.15, 0.03), m.dark, bevel=0.015)
        o.append(boot)
    o.append(eisen.box('torso', (0.3, 0.2, 0.34), (0, 0, 0.52 + bob), m.suit, bevel=0.04))
    o.append(eisen.box('belt', (0.31, 0.21, 0.05), (0, 0, 0.38 + bob), m.dark))
    o.append(eisen.box('pack', (0.24, 0.12, 0.28), (0, 0.15, 0.55 + bob), m.steel, bevel=0.03))
    o.append(eisen.cylinder('tank', 0.05, 0.22, (0.08, 0.2, 0.6 + bob), m.ochre, segments=10))
    for side, s in (('L', -1), ('R', 1)):
        arm = eisen.box('arm' + side, (0.08, 0.09, 0.3), (s * 0.2, 0, 0.52 + bob), m.suit, bevel=0.02)
        arm.rotation_euler = (-swing * s * 0.8, 0, 0)
        o.append(arm)
    o.append(eisen.cylinder('neck', 0.05, 0.06, (0, 0, 0.71 + bob), m.skin, segments=10))
    head = bpy.data.meshes.new('head')
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.11)
    bm.to_mesh(head)
    bm.free()
    ho = bpy.data.objects.new('head', head)
    ho.data.materials.append(m.skin)
    ho.location = (0, 0, 0.82 + bob)
    eisen.link(ho)
    for p in head.polygons:
        p.use_smooth = True
    o.append(ho)
    helm = eisen.cylinder('helmet', 0.13, 0.08, (0, 0.01, 0.9 + bob), m.ochre, segments=16, bevel=0.03)
    o.append(helm)
    o.append(eisen.box('visor', (0.16, 0.03, 0.05), (0, -0.1, 0.83 + bob), m.visor))
    return eisen.parent_all(o, 'worker')


# --------------------------------------------------------------------------- Erze

ORE_MATS = {}


def ore_material(res):
    S = eisen.srgb
    if res == 'iron-ore':
        return eisen.material('iron', S('#7a8ea3'), rough=0.5, metal=0.35, noise=0.3, noise_scale=22, rust=0.4,
                              rust_color=S('#8a4a26'), bump=0.5)
    if res == 'coal':
        return eisen.material('coal', S('#1d1d1f'), rough=0.35, metal=0.1, noise=0.5, noise_scale=30, bump=0.6)
    return eisen.material('stone', S('#9a8869'), rough=0.9, noise=0.3, noise_scale=16, bump=0.5)


def ore_pile(res, count, size, seed, spread=0.4, z0=0.0):
    rnd = random.Random(seed)
    mat = ore_material(res)
    o = []
    pts = []
    tries = 0
    while len(pts) < count and tries < 400:
        tries += 1
        r = size * (0.6 + rnd.random() * 0.6)
        x = (rnd.random() - 0.5) * 2 * spread
        y = (rnd.random() - 0.5) * 2 * spread
        if any((x - px) ** 2 + (y - py) ** 2 < (r + pr) ** 2 * 0.55 for px, py, pr in pts):
            continue
        pts.append((x, y, r))
    for i, (x, y, r) in enumerate(pts):
        squash = 0.45 if res != 'coal' else 0.6
        o.append(eisen.rock(f'r{i}', r, (x, y, z0 + r * squash * 0.4), mat, seed * 100 + i, squash=squash, detail=2))
    return o


def gear_item(m):
    g = gear('gearItem', 0.36, 0.28, 10, 0.1, m.plate, hole=0.1)
    return g
