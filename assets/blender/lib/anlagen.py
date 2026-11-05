"""Anlagen der Strom-, Montage- und Logistikstufe (eigene Formen, Stil wie bauten.py).

Alle Modelle für Richtung Nord (Ausgabe/Fluss nach +Y), mittig um den Ursprung, 1 Feld = 1 Einheit.
"""
import math
import random

import bauten
import bmesh  # noqa: F401  (bpy wird von render.py vorher geladen)
import bpy  # noqa: F401
import eisen
import gw_ground
from bauten import beam, bolts, pipe

lin = gw_ground.lin

PIPE_R = 0.13
PIPE_Z = 0.24


class Mats(bauten.Mats):
    """bauten.Mats plus Farben für Anlagen."""

    def __init__(self):
        super().__init__()
        self.pipe = bauten.weathered('a_pipe', '#5a5c58', metal=0.8, rough=0.42, rust=0.4, dust=0.45, edge=0.55, streaks=0.4)
        self.green = bauten.weathered('a_green', '#4d5f49', metal=0.35, rough=0.55, rust=0.35, dust=0.55, edge=0.65, streaks=0.4)
        self.red = bauten.weathered('a_red', '#6e3527', metal=0.3, rough=0.58, rust=0.35, dust=0.5, edge=0.65, streaks=0.4)
        self.copper = bauten.weathered('a_copper', '#a8643a', metal=0.9, rough=0.35, rust=0.25, dust=0.3, edge=0.5,
                                       rust_hex='#4f7a62')
        self.brick = gw_ground.pmat('a_brick', lin('#7b4a35'), 0.95, 0.35, 0.6, 18)
        self.concrete = gw_ground.pmat('a_conc', lin('#8b857a'), 0.95, 0.3, 0.5, 22)
        self.glass = eisen.material('a_glass', eisen.srgb('#6f8a8f'), rough=0.08, metal=0.2)
        self.insul = eisen.material('a_insul', eisen.srgb('#c9c2ae'), rough=0.3)
        self.rust = bauten.weathered('a_rust', '#6b3c1f', metal=0.2, rough=0.85, rust=0.6, dust=0.3, edge=0.2)
        self.water = eisen.material('a_water', eisen.srgb('#2e4b55'), rough=0.15, metal=0.1)


def flange(o, name, loc, axis, m, r=PIPE_R * 1.35):
    rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
    o.append(eisen.cylinder(name, r, 0.05, loc, m.dark, segments=16, rot=rot, bevel=0.008))


# --------------------------------------------------------------------------- Rohr

DIRV = [(0, 1), (1, 0), (0, -1), (-1, 0)]  # N, O, S, W (Blender)


def pipe_piece(m, mask, seed=0):
    """Rohrstück mit Anschlüssen nach mask (N=1, O=2, S=4, W=8). Ohne Anschluss: kurzes Rohr mit Kappen."""
    o = []
    dirs = [k for k in range(4) if mask & (1 << k)]
    z = PIPE_Z
    straight = len(dirs) == 2 and (dirs[0] + 2) % 4 == dirs[1]
    if not dirs:
        o.append(pipe('p', (0, -0.32, z), (0, 0.32, z), PIPE_R, m.pipe, 20))
        for s in (-1, 1):
            o.append(eisen.cylinder(f'cap{s}', PIPE_R * 1.15, 0.06, (0, s * 0.33, z), m.dark, segments=20, rot=(math.pi / 2, 0, 0)))
    else:
        for k in dirs:
            dx, dy = DIRV[k]
            o.append(pipe(f'arm{k}', (0, 0, z), (dx * 0.53, dy * 0.53, z), PIPE_R, m.pipe, 20))
            axis = 'Y' if dy else 'X'
            flange(o, f'fl{k}', (dx * 0.47, dy * 0.47, z), axis, m)
        if len(dirs) == 1:
            dx, dy = DIRV[dirs[0]]
            o.append(eisen.cylinder('end', PIPE_R * 1.12, 0.06, (-dx * 0.05, -dy * 0.05, z), m.dark, segments=20,
                                    rot=(math.pi / 2, 0, 0) if dy else (0, math.pi / 2, 0)))
        if not straight:
            # Verbindungsstück: gerundeter Knoten mit Gussnaht
            o.append(eisen.cylinder('joint', PIPE_R * 1.2, PIPE_R * 2.3, (0, 0, z), m.pipe, segments=24, bevel=PIPE_R * 0.75))
            o.append(eisen.cylinder('seam', PIPE_R * 1.22, 0.02, (0, 0, z), m.dark, segments=24))
    # Stützbock
    o.append(eisen.box('foot', (0.3, 0.1, z - PIPE_R + 0.02), (0, 0, (z - PIPE_R) / 2), m.dark, bevel=0.01))
    o.append(eisen.box('footplate', (0.36, 0.18, 0.02), (0, 0, 0.01), m.steel))
    return eisen.parent_all(o, 'pipe')


# --------------------------------------------------------------------------- Uferpumpe 1×1

def offshore_pump(m, phase=0.0):
    """Steg über das Wasser (Süden, -Y) mit Saugrohr, Pumpengehäuse und Rohranschluss nach Norden."""
    o = []
    # Steg ragt über den Rand nach Süden
    o.append(eisen.box('deck', (0.8, 1.15, 0.06), (0, -0.22, 0.2), m.steel, bevel=0.01))
    for sx in (-0.36, 0.36):
        o.append(eisen.box(f'rail{sx}', (0.05, 1.1, 0.05), (sx, -0.22, 0.48), m.paint))
        for y in (-0.7, -0.2, 0.25):
            o.append(eisen.box(f'post{sx}{y}', (0.04, 0.04, 0.3), (sx, y, 0.34), m.paint))
    for y in (-0.7, 0.25):
        for sx in (-0.33, 0.33):
            o.append(eisen.cylinder(f'leg{sx}{y}', 0.035, 0.5, (sx, y, -0.05), m.dark, segments=8))
    # Saugrohr ins Wasser
    o.append(pipe('suction', (0, -0.62, 0.2), (0, -0.62, -0.25), 0.09, m.pipe))
    o.append(eisen.cylinder('strainer', 0.13, 0.12, (0, -0.62, -0.2), m.dark, segments=16))
    # Pumpengehäuse
    o.append(eisen.cylinder('volute', 0.24, 0.26, (0, -0.15, 0.4), m.green, segments=28, bevel=0.02))
    o.append(eisen.cylinder('motor', 0.15, 0.3, (0, -0.15, 0.68), m.dark, segments=20, bevel=0.01))
    for k in range(8):
        a = k / 8 * math.tau + phase * math.tau
        o.append(eisen.box(f'fin{k}', (0.02, 0.06, 0.26), (math.cos(a) * 0.155, -0.15 + math.sin(a) * 0.155, 0.68), m.steel))
    o.append(pipe('out', (0, -0.15, 0.3), (0, 0.53, PIPE_Z), PIPE_R, m.pipe, 20))
    flange(o, 'flo', (0, 0.47, PIPE_Z), 'Y', m)
    bolts(o, m.bright, [(0.3, -0.75), (-0.3, -0.75), (0.3, 0.3), (-0.3, 0.3)], 0.235, 0.02)
    return eisen.parent_all(o, 'pump')


# --------------------------------------------------------------------------- Kessel 3×2

def boiler(m, fire=0.0):
    """Liegender Kessel auf gemauerter Feuerung. Dampf oben nach Norden (Mitte), Wasser an beiden Enden (Süd-Reihe)."""
    o = []
    # Feuerung aus Ziegeln
    o.append(eisen.box('firebox', (2.5, 1.5, 0.55), (0, -0.1, 0.275), m.brick, bevel=0.03))
    o.append(eisen.box('fireframe', (2.56, 1.56, 0.06), (0, -0.1, 0.56), m.dark, bevel=0.01))
    # Feuertür mit Glut (Süden)
    o.append(eisen.box('door', (0.5, 0.05, 0.32), (0, -0.87, 0.28), m.dark, bevel=0.01))
    glow = eisen.emission_material('bfire', (1.0, 0.38, 0.1), 2.0 + 10.0 * fire)
    o.append(eisen.box('doorglow', (0.36, 0.02, 0.1), (0, -0.9, 0.2), glow))
    if fire > 0:
        light = bpy.data.lights.new('bfire', 'POINT')
        light.energy = 30 * fire
        light.color = (1.0, 0.5, 0.2)
        lo = bpy.data.objects.new('bfire', light)
        lo.location = (0, -1.05, 0.25)
        eisen.link(lo)
    # Kesseltrommel
    o.append(eisen.cylinder('drum', 0.5, 2.2, (0, 0.05, 0.98), m.steel, segments=40, rot=(0, math.pi / 2, 0), bevel=0.02))
    for x in (-1.0, -0.35, 0.35, 1.0):
        o.append(eisen.cylinder(f'hoop{x}', 0.52, 0.05, (x, 0.05, 0.98), m.dark, segments=40, rot=(0, math.pi / 2, 0)))
    for s in (-1, 1):
        o.append(eisen.cylinder(f'endcap{s}', 0.44, 0.06, (s * 1.12, 0.05, 0.98), m.paint, segments=40, rot=(0, math.pi / 2, 0), bevel=0.02))
    # Dampfdom und Ventil, Ausgang nach Norden in der Mitte
    o.append(eisen.cylinder('dome', 0.2, 0.3, (0, 0.2, 1.55), m.paint, segments=24, bevel=0.03))
    o.append(eisen.cylinder('valve', 0.06, 0.18, (0.35, 0.05, 1.55), m.brass, segments=12))
    o.append(pipe('steam', (0, 0.2, 1.6), (0, 0.75, 1.6), PIPE_R * 0.9, m.pipe, 20))
    o.append(pipe('steamdown', (0, 0.75, 1.6), (0, 0.75, PIPE_Z), PIPE_R * 0.9, m.pipe, 20))
    o.append(pipe('steamout', (0, 0.75, PIPE_Z), (0, 1.03, PIPE_Z), PIPE_R, m.pipe, 20))
    flange(o, 'fls', (0, 0.97, PIPE_Z), 'Y', m)
    # Wasseranschlüsse an beiden Enden (Süd-Reihe y = -0.5)
    for s in (-1, 1):
        o.append(pipe(f'win{s}', (s * 1.0, -0.5, PIPE_Z), (s * 1.53, -0.5, PIPE_Z), PIPE_R, m.pipe, 20))
        flange(o, f'flw{s}', (s * 1.47, -0.5, PIPE_Z), 'X', m)
        o.append(pipe(f'wup{s}', (s * 1.05, -0.5, PIPE_Z), (s * 1.05, -0.1, 0.75), PIPE_R * 0.7, m.pipe))
    # Schornstein hinten links
    o.append(eisen.cylinder('stack', 0.14, 1.2, (-0.85, -0.55, 1.15), m.dark, segments=20))
    o.append(eisen.cylinder('stacktop', 0.18, 0.08, (-0.85, -0.55, 1.78), m.rust, segments=20))
    o.append(eisen.cylinder('gauge', 0.07, 0.03, (0.6, -0.47, 1.1), m.insul, segments=16, rot=(math.pi / 2, 0, 0)))
    bolts(o, m.bright, [(x, -0.86) for x in (-1.15, -0.6, 0.6, 1.15)], 0.5, 0.02, 'Y')
    rnd = random.Random(5)
    soot = [gw_ground.pmat(f'bsoot{i}', lin(h), 1.0, 0.3, 0.6, 25) for i, h in enumerate(['#2a2420', '#3d3328', '#4a3e30'])]
    o.extend(bauten.stones(30, rnd, soot, lambda x, y: y < -0.9 and abs(x) < 0.6, (0.02, 0.045)))
    return eisen.parent_all(o, 'boiler')


# --------------------------------------------------------------------------- Dampfmaschine 3×5

def steam_engine(m, phase=0.0):
    """Liegender Zylinder entlang Y (Dampf von Süd nach Nord durch), Schwungrad an der Ostseite."""
    o = []
    o.append(eisen.box('bed', (2.4, 4.6, 0.22), (0, 0, 0.11), m.concrete, bevel=0.03))
    o.append(eisen.box('frame', (1.2, 4.2, 0.16), (-0.35, 0, 0.3), m.dark, bevel=0.02))
    # Zylinder
    o.append(eisen.cylinder('cyl', 0.42, 1.5, (-0.35, 1.1, 0.75), m.green, segments=36, rot=(math.pi / 2, 0, 0), bevel=0.03))
    for y in (0.4, 1.8):
        o.append(eisen.cylinder(f'cylcap{y}', 0.47, 0.1, (-0.35, y, 0.75), m.dark, segments=36, rot=(math.pi / 2, 0, 0), bevel=0.02))
    o.append(eisen.box('valvebox', (0.4, 1.0, 0.3), (-0.35, 1.1, 1.25), m.green, bevel=0.03))
    # Kolbenstange und Kreuzkopf
    a = phase * math.tau
    crank_y = -1.1
    cr = 0.32
    px = crank_y + math.cos(a) * cr
    cross_y = 0.15 + math.cos(a) * cr * 0.95
    o.append(pipe('rod', (-0.35, 0.4, 0.75), (-0.35, cross_y, 0.75), 0.05, m.bright))
    o.append(eisen.box('cross', (0.22, 0.2, 0.2), (-0.35, cross_y, 0.75), m.dark, bevel=0.02))
    o.append(eisen.box('guide', (0.36, 1.1, 0.06), (-0.35, 0.15, 0.55), m.steel))
    # Kurbelwelle und Schwungrad (Achse X)
    o.append(pipe('shaft', (-0.6, crank_y, 0.75), (1.05, crank_y, 0.75), 0.07, m.steel))
    o.append(flywheel('fly', 0.82, 0.14, 6, m.dark, m.steel, (0.8, crank_y, 0.9), a))
    cz = 0.75 + math.sin(a) * cr
    o.append(beam('conrod', (-0.35, cross_y, 0.75), (-0.35, px, cz), (0.07, 0.07), m.steel))
    o.append(eisen.box('bearing', (0.3, 0.3, 0.45), (0.4, crank_y, 0.5), m.dark, bevel=0.02))
    # Fliehkraftregler
    o.append(eisen.cylinder('gov', 0.03, 0.4, (-0.85, 0.2, 0.75), m.brass, segments=8))
    for k in range(2):
        b = a * 2 + k * math.pi
        o.append(eisen.cylinder(f'govb{k}', 0.06, 0.06, (-0.85 + math.cos(b) * 0.12, 0.2 + math.sin(b) * 0.12, 0.9), m.brass, segments=10))
    # Dampfrohr Nord/Süd (Mitte x=0), Anschlüsse an beiden Enden
    for s, y0, y1 in ((1, 1.8, 2.53), (-1, -2.53, 0.4)):
        o.append(pipe(f'sp{s}', (0.55, y0 if s > 0 else y1, PIPE_Z + 0.25), (0.55, y1 if s > 0 else y0, PIPE_Z + 0.25), PIPE_R, m.pipe, 20))
    o.append(pipe('spN', (0.55, 2.3, PIPE_Z + 0.25), (0, 2.3, PIPE_Z), PIPE_R, m.pipe, 20))
    o.append(pipe('spN2', (0, 2.2, PIPE_Z), (0, 2.53, PIPE_Z), PIPE_R, m.pipe, 20))
    o.append(pipe('spS', (0.55, -2.3, PIPE_Z + 0.25), (0, -2.3, PIPE_Z), PIPE_R, m.pipe, 20))
    o.append(pipe('spS2', (0, -2.2, PIPE_Z), (0, -2.53, PIPE_Z), PIPE_R, m.pipe, 20))
    flange(o, 'fln', (0, 2.47, PIPE_Z), 'Y', m)
    flange(o, 'fls', (0, -2.47, PIPE_Z), 'Y', m)
    o.append(pipe('feed', (0.55, 1.1, PIPE_Z + 0.25), (-0.1, 1.1, 1.2), PIPE_R * 0.7, m.pipe))
    # Generator am Wellenende
    o.append(eisen.cylinder('gen', 0.38, 0.55, (-0.25, -1.9, 0.62), m.paint, segments=32, rot=(0, math.pi / 2, 0), bevel=0.03))
    for k in range(10):
        b = k / 10 * math.tau
        o.append(eisen.box(f'genfin{k}', (0.5, 0.03, 0.06), (-0.25, -1.9 + math.cos(b) * 0.39, 0.62 + math.sin(b) * 0.39), m.dark))
    o.append(eisen.box('terminal', (0.25, 0.2, 0.18), (-0.25, -1.9, 1.05), m.dark, bevel=0.02))
    bolts(o, m.bright, [(x, y) for x in (-1.1, 1.1) for y in (-2.2, -0.8, 0.8, 2.2)], 0.225, 0.025)
    return eisen.parent_all(o, 'engine')


def flywheel(name, r, w, spokes, mat, hub_mat, loc, angle):
    """Speichenrad mit Achse X: Kranz aus Segmenten, Speichen, Nabe. angle = Drehung."""
    o = []
    n = 28
    seg = 2 * math.pi * r / n * 1.08
    for k in range(n):
        b = k / n * math.tau + angle
        y, z = math.cos(b) * r, math.sin(b) * r
        q = eisen.box(f'{name}r{k}', (w, seg, 0.11), (0, y, z), mat, bevel=0.01)
        q.rotation_euler = (b + math.pi / 2, 0, 0)
        o.append(q)
    for k in range(spokes):
        b = k / spokes * math.tau + angle
        o.append(beam(f'{name}s{k}', (0, 0, 0), (0, math.cos(b) * r * 0.95, math.sin(b) * r * 0.95), (0.05, 0.04), mat))
    o.append(eisen.cylinder(f'{name}h', r * 0.16, w * 1.5, (0, 0, 0), hub_mat, segments=16, rot=(0, math.pi / 2, 0)))
    root = eisen.parent_all(o, name)
    root.location = loc
    return root


# --------------------------------------------------------------------------- Kleiner Strommast

POLE_TOP = 1.65  # Höhe der Isolatoren (Kabelpunkt)


def small_pole(m):
    """Schlanker Stahlmast (aus Eisenstangen) mit Querträger und zwei Porzellanisolatoren."""
    o = []
    o.append(eisen.box('foot', (0.3, 0.3, 0.08), (0, 0, 0.04), m.concrete, bevel=0.02))
    o.append(eisen.box('mast', (0.09, 0.09, POLE_TOP), (0, 0, POLE_TOP / 2 + 0.05), m.steel, bevel=0.01))
    for s in (-1, 1):
        o.append(beam(f'brace{s}', (s * 0.12, 0, 0.08), (0, 0, 0.6), (0.03, 0.03), m.dark))
    o.append(eisen.box('cross', (0.62, 0.06, 0.06), (0, 0, POLE_TOP - 0.12), m.paint, bevel=0.01))
    for s in (-1, 1):
        o.append(beam(f'strut{s}', (0, 0, POLE_TOP - 0.45), (s * 0.24, 0, POLE_TOP - 0.15), (0.025, 0.025), m.dark))
        for k in range(3):
            o.append(eisen.cylinder(f'ins{s}{k}', 0.045 - k * 0.006, 0.035, (s * 0.26, 0, POLE_TOP - 0.06 + k * 0.04), m.insul, segments=12))
    o.append(eisen.cylinder('cap', 0.06, 0.05, (0, 0, POLE_TOP + 0.07), m.dark, segments=12))
    return eisen.parent_all(o, 'pole')


# --------------------------------------------------------------------------- Elektrischer Bohrer 3×3

def electric_drill(m, phase=0.0):
    """Kastenrahmen mit Bohrturm in der Mitte, Elektromotor, Kühlrippen und Ausgaberutsche nach Norden (Mitte)."""
    o = []
    o.append(eisen.box('skid', (2.8, 2.8, 0.16), (0, 0, 0.08), m.dark, bevel=0.03))
    o.append(eisen.box('body', (2.3, 2.1, 0.7), (0, -0.15, 0.51), m.green, bevel=0.06))
    o.append(eisen.box('band', (2.34, 2.14, 0.08), (0, -0.15, 0.8), m.dark, bevel=0.01))
    # Bohrturm (Gitter) mit Bohrkopf, der sich dreht
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(beam(f'tw{sx}{sy}', (sx * 0.42, -0.15 + sy * 0.42, 0.85), (sx * 0.16, -0.15 + sy * 0.16, 1.85), (0.06, 0.06), m.paint))
    for z in (1.2, 1.55):
        k = 0.42 - (z - 0.85) * 0.26
        for sy in (-1, 1):
            o.append(eisen.box(f'rx{z}{sy}', (2 * k, 0.04, 0.04), (0, -0.15 + sy * k, z), m.dark))
            o.append(eisen.box(f'ry{z}{sy}', (0.04, 2 * k, 0.04), (sy * k, -0.15, z), m.dark))
    o.append(eisen.box('head', (0.42, 0.42, 0.22), (0, -0.15, 1.92), m.dark, bevel=0.03))
    g = bauten.gear('dg', 0.28, 0.23, 14, 0.06, m.brass)
    g.location = (0, -0.15, 2.06)
    g.rotation_euler = (0, 0, phase * math.tau / 7)
    o.append(g)
    o.append(pipe('kelly', (0, -0.15, 0.85), (0, -0.15, 1.9), 0.06, m.bright))
    # Motor an der Ostseite
    o.append(eisen.cylinder('motor', 0.3, 0.85, (0.82, -0.6, 1.12), m.dark, segments=28, rot=(math.pi / 2, 0, 0), bevel=0.02))
    for k in range(12):
        b = k / 12 * math.pi + math.pi / 12
        o.append(eisen.box(f'mf{k}', (0.03, 0.8, 0.07), (0.82 + math.cos(b) * 0.31, -0.6, 1.12 + math.sin(b) * 0.31), m.steel))
    o.append(eisen.box('cbox', (0.4, 0.3, 0.3), (-0.75, -0.75, 1.0), m.dark, bevel=0.02))
    o.append(eisen.box('lamp', (0.08, 0.02, 0.06), (-0.75, -0.91, 1.05), eisen.emission_material('lamp', (0.4, 1.0, 0.35), 3.0)))
    # Ausgaberutsche nach Norden
    o.append(eisen.box('chute', (0.48, 0.75, 0.2), (0, 1.12, 0.48), m.paint, bevel=0.02, rot=(math.radians(-15), 0, 0)))
    o.append(eisen.box('chuteIn', (0.34, 0.7, 0.06), (0, 1.15, 0.56), m.soot, rot=(math.radians(-15), 0, 0)))
    bolts(o, m.bright, [(x, y) for x in (-1.25, 1.25) for y in (-1.25, 1.25)], 0.17, 0.03)
    # Bohrgut um den Rahmen
    rnd = random.Random(77)
    earth = [gw_ground.pmat(f'esp{i}', lin(h), 1.0, 0.3, 0.6, 25) for i, h in enumerate(['#4f3f2e', '#5d4a35', '#6b6458', '#3e3226'])]
    spoil = bauten.stones(120, rnd, earth, lambda x, y: 0.93 < max(abs(x), abs(y)) < 0.995 and not (y > 0.9 and abs(x) < 0.3),
                          (0.025, 0.06))
    for st in spoil:
        st.location.x *= 1.5
        st.location.y *= 1.5
    o.extend(spoil)
    return eisen.parent_all(o, 'edrill')


# --------------------------------------------------------------------------- Montagemaschine 3×3

def assembler(m, phase=0.0):
    """Gehäuse mit Sichtfenster, umlaufendem Greifer über einer Werkbank und Lüfter auf dem Dach."""
    o = []
    o.append(eisen.box('base', (2.8, 2.8, 0.18), (0, 0, 0.09), m.dark, bevel=0.03))
    # Eckpfeiler und Dach
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'pil{sx}{sy}', (0.32, 0.32, 1.1), (sx * 1.18, sy * 1.18, 0.73), m.paint, bevel=0.03))
    o.append(eisen.box('roof', (2.7, 2.7, 0.14), (0, 0, 1.34), m.green, bevel=0.03))
    o.append(eisen.box('roofrim', (2.76, 2.76, 0.05), (0, 0, 1.28), m.dark, bevel=0.01))
    for x in (-0.9, 0.0):
        o.append(eisen.box(f'roofrib{x}', (0.06, 2.5, 0.05), (x, 0, 1.43), m.dark))
    # Seitenwände nur Nord/West/Ost, Süden (Kamera) mit Fenster
    o.append(eisen.box('wallN', (2.1, 0.1, 1.0), (0, 1.2, 0.7), m.steel, bevel=0.01))
    o.append(eisen.box('wallW', (0.1, 2.1, 1.0), (-1.2, 0, 0.7), m.steel, bevel=0.01))
    o.append(eisen.box('wallE', (0.1, 2.1, 1.0), (1.2, 0, 0.7), m.steel, bevel=0.01))
    o.append(eisen.box('wallSlo', (2.1, 0.1, 0.35), (0, -1.2, 0.36), m.steel, bevel=0.01))
    o.append(eisen.box('wallShi', (2.1, 0.1, 0.18), (0, -1.2, 1.18), m.steel, bevel=0.01))
    o.append(eisen.box('window', (2.0, 0.03, 0.62), (0, -1.21, 0.84), m.glass))
    for x in (-0.5, 0.5):
        o.append(eisen.box(f'mull{x}', (0.05, 0.06, 0.62), (x, -1.22, 0.84), m.dark))
    # Werkbank und umlaufender Arm (im Inneren, durchs Fenster sichtbar)
    o.append(eisen.box('bench', (1.2, 0.8, 0.12), (0, 0.1, 0.62), m.dark, bevel=0.02))
    a = phase * math.tau
    o.append(eisen.cylinder('col', 0.08, 0.6, (0, 0.1, 0.95), m.bright, segments=12))
    o.append(beam('jib', (0, 0.1, 1.15), (math.cos(a) * 0.55, 0.1 + math.sin(a) * 0.4, 1.15), (0.06, 0.06), m.paint))
    o.append(eisen.box('tool', (0.1, 0.1, 0.25), (math.cos(a) * 0.55, 0.1 + math.sin(a) * 0.4, 1.0), m.dark))
    # Dachlüfter
    o.append(eisen.cylinder('fanwell', 0.46, 0.04, (0.45, 0.35, 1.42), m.soot, segments=32))
    for k in range(20):
        b = k / 20 * math.tau
        q = eisen.box(f'fanring{k}', (0.07, 0.16, 0.14), (0.45 + math.cos(b) * 0.5, 0.35 + math.sin(b) * 0.5, 1.48), m.dark, bevel=0.01)
        q.rotation_euler = (0, 0, b)
        o.append(q)
    for k in range(5):
        b = k / 5 * math.tau + a * 2
        bl = beam(f'blade{k}', (0.45, 0.35, 1.5), (0.45 + math.cos(b) * 0.42, 0.35 + math.sin(b) * 0.42, 1.5), (0.15, 0.015), m.bright)
        bl.rotation_euler.rotate_axis('Y', math.radians(18))
        o.append(bl)
    o.append(eisen.cylinder('hub', 0.08, 0.08, (0.45, 0.35, 1.53), m.paint, segments=12))
    o.append(eisen.box('hatch', (0.5, 0.5, 0.05), (-0.7, 0.55, 1.43), m.steel, bevel=0.01))
    o.append(eisen.box('hatchh', (0.16, 0.03, 0.03), (-0.7, 0.32, 1.47), m.bright))
    o.append(eisen.box('vent', (0.6, 0.35, 0.12), (-0.6, -0.5, 1.47), m.dark, bevel=0.02))
    o.append(pipe('conduit', (-1.25, -0.6, 0.3), (-1.25, -0.6, 1.3), 0.04, m.dark))
    o.append(eisen.box('lamp', (0.1, 0.02, 0.06), (0.9, -1.27, 1.2), eisen.emission_material('alamp', (1.0, 0.7, 0.2), 3.0)))
    bolts(o, m.bright, [(x, y) for x in (-1.3, 1.3) for y in (-1.3, 1.3)], 0.19, 0.03)
    return eisen.parent_all(o, 'assembler')


# --------------------------------------------------------------------------- Labor 3×3

def lab(m, phase=0.0):
    """Achteckiger Sockel mit Glaskuppel, darin ein Ring mit Proben, der sich dreht."""
    o = []
    o.append(eisen.cylinder('base', 1.38, 0.22, (0, 0, 0.11), m.dark, segments=8, bevel=0.03, rot=(0, 0, math.pi / 8)))
    o.append(eisen.cylinder('plinth', 1.2, 0.4, (0, 0, 0.42), m.steel, segments=8, bevel=0.04, rot=(0, 0, math.pi / 8)))
    o.append(eisen.cylinder('band', 1.22, 0.07, (0, 0, 0.6), m.copper, segments=8, rot=(0, 0, math.pi / 8)))
    me = bpy.data.meshes.new('dome')
    import bmesh as _bm
    bm = _bm.new()
    _bm.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=0.95)
    for v in list(bm.verts):
        if v.co.z < -0.01:
            bm.verts.remove(v)
    bm.to_mesh(me)
    bm.free()
    dome = bpy.data.objects.new('dome', me)
    eisen.link(dome)
    dome.data.materials.append(m.glass)
    dome.location = (0, 0, 0.62)
    dome.scale = (1, 1, 0.8)
    for poly in dome.data.polygons:
        poly.use_smooth = True
    o.append(dome)
    for k in range(6):
        b = k / 6 * math.tau
        o.append(beam(f'rib{k}', (math.cos(b) * 0.96, math.sin(b) * 0.96, 0.62), (math.cos(b) * 0.3, math.sin(b) * 0.3, 1.33), (0.04, 0.04), m.dark))
    o.append(eisen.cylinder('top', 0.3, 0.12, (0, 0, 1.38), m.copper, segments=24, bevel=0.02))
    # Innen: Säule und drehender Probenring
    o.append(eisen.cylinder('core', 0.18, 0.6, (0, 0, 0.9), m.bright, segments=16))
    a = phase * math.tau
    ring = eisen.cylinder('ring', 0.62, 0.05, (0, 0, 0.95), m.copper, segments=36)
    o.append(ring)
    cols = [(0.9, 0.2, 0.15), (0.25, 0.8, 0.3), (0.95, 0.75, 0.2), (0.3, 0.5, 0.95)]
    for k in range(8):
        b = a + k / 8 * math.tau
        mat = eisen.emission_material(f'vial{k}', cols[k % 4], 2.5)
        o.append(eisen.cylinder(f'vial{k}', 0.05, 0.18, (math.cos(b) * 0.55, math.sin(b) * 0.55, 1.06), mat, segments=10))
    o.append(eisen.box('console', (0.5, 0.2, 0.3), (0, -1.12, 0.45), m.dark, bevel=0.02, rot=(math.radians(-20), 0, 0)))
    o.append(eisen.box('screen', (0.36, 0.02, 0.16), (0, -1.23, 0.5), eisen.emission_material('screen', (0.3, 0.9, 0.7), 2.0), rot=(math.radians(-20), 0, 0)))
    bolts(o, m.bright, [(math.cos(b) * 1.25, math.sin(b) * 1.25) for b in [k / 8 * math.tau + math.pi / 8 for k in range(8)]], 0.225, 0.03)
    return eisen.parent_all(o, 'lab')


# --------------------------------------------------------------------------- Untergrundband

def underground(m, output=False):
    """Haube über einer Hälfte des Felds: Eingang (Band läuft von Süden hinein, Haube im Norden),
    Ausgang (Haube im Süden, Band läuft nach Norden heraus)."""
    o = []
    s = -1 if output else 1  # Haubenseite: Norden (+Y) beim Eingang
    y0 = 0.0
    y1 = s * 0.56
    yc = (y0 + y1) / 2
    depth = abs(y1 - y0)
    # Seitenwangen
    for sx in (-1, 1):
        o.append(eisen.box(f'cheek{sx}', (0.1, depth, 0.42), (sx * 0.45, yc, 0.21), m.paint, bevel=0.015))
    # schräges Dach zur Öffnung hin
    roof = eisen.box('roof', (1.0, depth + 0.08, 0.08), (0, yc + s * 0.02, 0.4), m.paint, bevel=0.02)
    roof.rotation_euler = (s * math.radians(14), 0, 0)
    o.append(roof)
    o.append(eisen.box('back', (1.0, 0.08, 0.4), (0, y1 - s * 0.02, 0.2), m.dark, bevel=0.01))
    # Öffnung: dunkler Schacht
    o.append(eisen.box('mouth', (0.8, 0.04, 0.3), (0, y0 + s * 0.04, 0.16), m.soot))
    o.append(eisen.box('lip', (0.96, 0.06, 0.06), (0, y0 + s * 0.03, 0.34), m.dark, bevel=0.01))
    # Versteifungsrippen auf dem Dach
    for k in (-0.25, 0.25):
        rib = eisen.box(f'rib{k}', (0.04, depth * 0.9, 0.03), (k, yc + s * 0.02, 0.45), m.dark)
        rib.rotation_euler = (s * math.radians(14), 0, 0)
        o.append(rib)
    bolts(o, m.bright, [(sx * 0.45, yc) for sx in (-1, 1)], 0.43, 0.02)
    return eisen.parent_all(o, 'ug')


# --------------------------------------------------------------------------- Splitter 2×1

def splitter(m, phase=0.0):
    """Brücke quer über beide Bänder: Pfeiler außen und in der Mitte, Getriebekasten mit Verteilerzunge."""
    o = []
    for x in (-0.98, 0.98):
        o.append(eisen.box(f'pier{x}', (0.12, 0.7, 0.5), (x, 0, 0.25), m.paint, bevel=0.02))
    o.append(eisen.box('mid', (0.14, 0.9, 0.36), (0, -0.02, 0.18), m.paint, bevel=0.02))
    o.append(eisen.box('bridge', (2.06, 0.34, 0.12), (0, -0.05, 0.56), m.paint, bevel=0.02))
    o.append(eisen.box('gearbox', (0.5, 0.42, 0.3), (0, -0.05, 0.75), m.dark, bevel=0.03))
    g = bauten.gear('sg', 0.2, 0.16, 12, 0.05, m.brass)
    g.location = (0, -0.05, 0.92)
    g.rotation_euler = (0, 0, phase * math.tau / 6)
    o.append(g)
    # Zunge (Weiche) zeigt nach Norden
    o.append(eisen.box('tongue', (0.06, 0.5, 0.18), (0, 0.42, 0.17), m.bright, bevel=0.01))
    for x in (-0.5, 0.5):
        o.append(eisen.box(f'guide{x}', (0.86, 0.04, 0.05), (x, -0.3, 0.32), m.dark))
    o.append(eisen.box('stripe', (2.0, 0.01, 0.04), (0, -0.225, 0.56), m.dark))
    bolts(o, m.bright, [(x, -0.05) for x in (-0.98, -0.5, 0.5, 0.98)], 0.625, 0.02)
    return eisen.parent_all(o, 'splitter')


# --------------------------------------------------------------------------- Items

def copper_coil(m):
    o = []
    for k in range(5):
        t = eisen.cylinder(f'turn{k}', 0.3 - k * 0.002, 0.045, (0, 0, 0.05 + k * 0.045), m.copper, segments=32)
        mod = t.modifiers.new('solid', 'SOLIDIFY')
        mod.thickness = 0.06
        o.append(t)
    o.append(eisen.cylinder('core', 0.18, 0.26, (0, 0, 0.13), m.dark, segments=24))
    o.append(pipe('tail', (0.3, 0, 0.25), (0.42, 0.18, 0.08), 0.022, m.copper))
    return eisen.parent_all(o, 'coil')


def circuit(m):
    o = []
    board = bauten.weathered('a_pcb', '#2f5a33', metal=0.2, rough=0.5, rust=0.0, dust=0.15, edge=0.3, grime=0.2)
    o.append(eisen.box('pcb', (0.72, 0.52, 0.05), (0, 0, 0.03), board, bevel=0.01))
    o.append(eisen.box('chip', (0.26, 0.2, 0.06), (-0.1, 0.02, 0.08), m.dark, bevel=0.01))
    for k in range(5):
        o.append(eisen.box(f'pin{k}', (0.02, 0.05, 0.01), (-0.2 + k * 0.05, 0.14, 0.06), m.brass))
        o.append(eisen.box(f'pinb{k}', (0.02, 0.05, 0.01), (-0.2 + k * 0.05, -0.1, 0.06), m.brass))
    for k in range(3):
        o.append(eisen.cylinder(f'cap{k}', 0.035, 0.1, (0.18 + (k % 2) * 0.1, -0.12 + k * 0.12, 0.1), m.copper, segments=10))
    for k in range(4):
        o.append(eisen.box(f'trace{k}', (0.4, 0.012, 0.005), (0.05, -0.2 + k * 0.13, 0.058), m.copper))
    return eisen.parent_all(o, 'circuit')


def flask(m, color):
    """Wissenschaftspaket: bauchige Flasche mit farbiger Flüssigkeit, Glanz und Korken."""
    o = []
    liquid = eisen.material('a_liq', color, rough=0.12, metal=0.0)
    glow = eisen.emission_material('a_liqglow', color, 0.8)
    glass = eisen.material('a_fglass', eisen.srgb('#d8e4e2'), rough=0.05, metal=0.1)
    o.append(eisen.cylinder('body', 0.25, 0.34, (0, 0, 0.19), liquid, segments=32, bevel=0.1))
    o.append(eisen.cylinder('core', 0.2, 0.2, (0, 0, 0.2), glow, segments=24, bevel=0.06))
    o.append(eisen.cylinder('shine', 0.04, 0.2, (-0.16, -0.12, 0.22), glass, segments=10, bevel=0.015))
    o.append(eisen.cylinder('neck', 0.08, 0.2, (0, 0, 0.44), glass, segments=16))
    o.append(eisen.cylinder('lip', 0.1, 0.03, (0, 0, 0.54), glass, segments=16))
    o.append(eisen.cylinder('cork', 0.075, 0.08, (0, 0, 0.59), m.paint, segments=16))
    o.append(eisen.cylinder('label', 0.255, 0.07, (0, 0, 0.16), m.insul, segments=32))
    return eisen.parent_all(o, 'flask')


def brick_stack(m):
    o = []
    for k, (x, y, z, r) in enumerate([(-0.17, 0, 0.06, 0.0), (0.17, 0, 0.06, 0.0), (0, 0.02, 0.18, math.pi / 2)]):
        b = eisen.box(f'brick{k}', (0.3, 0.6, 0.12) if r == 0 else (0.3, 0.62, 0.12), (x, y, z), m.brick, bevel=0.02)
        b.rotation_euler = (0, 0, r)
        o.append(b)
    return eisen.parent_all(o, 'bricks')


def stick_bundle(m):
    o = []
    for k in range(5):
        o.append(pipe(f'st{k}', (-0.35, -0.1 + k * 0.05, 0.04 + (k % 2) * 0.05), (0.35, 0.1 + k * 0.05 - 0.1, 0.04 + (k % 2) * 0.05),
                      0.03, m.bright))
    return eisen.parent_all(o, 'sticks')



# --------------------------------------------------------------------------- Leuchtebene (wie Steinofen)

def load_pixels(path):
    img = bpy.data.images.load(path, check_existing=False)
    px = list(img.pixels)
    w, h = img.size
    bpy.data.images.remove(img)
    return px, w, h


def write_glow_diff(full, base, w, h, path, tint=(1.0, 0.55, 0.22), gain=1.6):
    """Additive Leuchtebene: Helligkeitszuwachs zwischen brennendem und ruhendem Bild, eingefärbt."""
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = bpy.data.images.new('glow', w, h, alpha=True)
    px = [0.0] * (w * h * 4)
    for i in range(0, len(px), 4):
        lf = (0.3 * full[i] + 0.59 * full[i + 1] + 0.11 * full[i + 2]) * full[i + 3]
        lb = (0.3 * base[i] + 0.59 * base[i + 1] + 0.11 * base[i + 2]) * base[i + 3]
        d = max(0.0, lf - lb) * gain
        for c in range(3):
            px[i + c] = min(1.0, d * tint[c])
        px[i + 3] = 1.0
    out.pixels = px
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)


def building(out, name, build, canvas, anchor, sh_canvas, sh_anchor, dirs=(0,), frames=1, samples=40, fps=15,
             glow=None, meta=None):
    """Rendert ein Gebäude: je Richtung frames Bilder (Phase 0..1), Schatten je Richtung, optional Leuchtebene.
    build(m, phase) -> Wurzelobjekt (Richtung Nord). Name: name.{d} bzw. name bei einer Richtung."""
    for d in dirs:
        key = f'{name}.{d}' if len(dirs) > 1 else name
        paths = []
        for f in range(frames):
            eisen.reset(samples=samples)
            root = build(Mats(), f / frames)
            eisen.rotate_root(root, d)
            eisen.camera(*canvas, anchor=anchor)
            paths.append(out.render_frame(key, f))
        out.add(key, 'entities', paths, anchor, fps=fps if frames > 1 else None, meta=meta)
        if glow:
            levels, glow_build = glow
            base, w, h = load_pixels(paths[0])
            gp = []
            for f, lv in enumerate(levels):
                eisen.reset(samples=samples)
                root = glow_build(Mats(), lv)
                eisen.rotate_root(root, d)
                eisen.camera(*canvas, anchor=anchor)
                tmp = out.frame_path(f'{key}.glowsrc', f)
                eisen.render_to(tmp)
                full, _, _ = load_pixels(tmp)
                p = out.frame_path(f'{key}.glow', f)
                write_glow_diff(full, base, w, h, p)
                gp.append(p)
            out.add(f'{key}.glow', 'entities', gp, anchor, fps=10, meta={'blend': 'add'})
        eisen.reset(samples=32)
        root = build(Mats(), 0.0)
        eisen.rotate_root(root, d)
        eisen.shadow_render(out, f'{key}.shadow', 'entities', sh_canvas, sh_anchor, half=sh_canvas[0] > 4)


# --------------------------------------------------------------------------- Frühe Phase: weitere Anlagen

def paint(hex_, name='a_paint2'):
    """Verwitterter Anstrich in eigener Farbe (für Varianten: schnelle Bänder, Montage 2, schneller Greifarm)."""
    return bauten.weathered(name, hex_, metal=0.3, rough=0.55, rust=0.4, dust=0.5, edge=0.7, streaks=0.5)


def pipe_ground(m):
    """Rohr unterirdisch: Anschluss nach Norden (+Y), nach Süden in einen Betonsockel abtauchend."""
    o = []
    z = PIPE_Z
    o.append(pipe('stub', (0, -0.05, z), (0, 0.53, z), PIPE_R, m.pipe, 20))
    flange(o, 'fl', (0, 0.47, z), 'Y', m)
    o.append(eisen.box('base', (0.62, 0.62, 0.16), (0, -0.12, 0.08), m.concrete, bevel=0.03))
    elbow = eisen.cylinder('elbow', PIPE_R * 1.25, 0.34, (0, -0.12, 0.2), m.pipe, segments=24, bevel=0.05)
    o.append(elbow)
    o.append(eisen.cylinder('collar', PIPE_R * 1.55, 0.06, (0, -0.12, 0.17), m.dark, segments=24, bevel=0.01))
    o.append(eisen.box('arrow', (0.08, 0.2, 0.01), (0, -0.33, 0.165), m.dark))
    bolts(o, m.bright, [(-0.24, -0.36), (0.24, -0.36), (-0.24, 0.12), (0.24, 0.12)], 0.165, 0.02)
    return eisen.parent_all(o, 'pipeground')


def fluid_pump(m, phase=0.0):
    """Pumpe 1×2 (Ursprung zwischen den Feldern): Ausgang nach Norden, Eingang nach Süden, Motor seitlich."""
    o = []
    z = PIPE_Z
    o.append(pipe('line', (0, -1.03, z), (0, 1.03, z), PIPE_R, m.pipe, 20))
    flange(o, 'fln', (0, 0.97, z), 'Y', m)
    flange(o, 'fls', (0, -0.97, z), 'Y', m)
    o.append(eisen.box('skid', (0.8, 1.5, 0.08), (0, 0, 0.04), m.dark, bevel=0.01))
    o.append(eisen.cylinder('volute', 0.3, 0.3, (0, 0.05, 0.36), m.green, segments=32, rot=(0, math.pi / 2, 0), bevel=0.03))
    o.append(eisen.cylinder('motor', 0.18, 0.5, (0, -0.45, 0.42), m.dark, segments=24, rot=(math.pi / 2, 0, 0), bevel=0.02))
    for k in range(10):
        a = k / 10 * math.pi + phase * 0.3
        o.append(eisen.box(f'fin{k}', (0.025, 0.46, 0.05), (math.cos(a) * 0.19, -0.45, 0.42 + math.sin(a) * 0.19), m.steel))
    o.append(eisen.box('lamp', (0.06, 0.02, 0.05), (0.22, -0.2, 0.55), eisen.emission_material('plamp', (0.4, 1.0, 0.35), 2.0)))
    bolts(o, m.bright, [(-0.34, -0.66), (0.34, -0.66), (-0.34, 0.66), (0.34, 0.66)], 0.085, 0.02)
    return eisen.parent_all(o, 'fpump')


def storage_tank(m):
    """Lagertank 3×3: stehender Zylinder mit Kuppel, Leiter, Anschlüsse an zwei Ecken (NW: N/W, SO: S/O)."""
    o = []
    o.append(eisen.box('pad', (2.9, 2.9, 0.1), (0, 0, 0.05), m.concrete, bevel=0.03))
    o.append(eisen.cylinder('shell', 1.25, 1.4, (0, 0, 0.8), m.steel, segments=48, bevel=0.03))
    for z in (0.35, 0.8, 1.25):
        o.append(eisen.cylinder(f'hoop{z}', 1.27, 0.05, (0, 0, z), m.dark, segments=48))
    me = bpy.data.meshes.new('cap')
    import bmesh as _bm
    bm = _bm.new()
    _bm.ops.create_uvsphere(bm, u_segments=48, v_segments=16, radius=1.25)
    for v in list(bm.verts):
        if v.co.z < -0.01:
            bm.verts.remove(v)
    bm.to_mesh(me)
    bm.free()
    cap = bpy.data.objects.new('cap', me)
    eisen.link(cap)
    cap.data.materials.append(m.paint)
    cap.location = (0, 0, 1.5)
    cap.scale = (1, 1, 0.35)
    for p in me.polygons:
        p.use_smooth = True
    o.append(cap)
    o.append(eisen.cylinder('hatch', 0.22, 0.08, (0.3, -0.2, 1.93), m.dark, segments=20, bevel=0.02))
    for k in range(9):
        o.append(eisen.box(f'rung{k}', (0.3, 0.03, 0.03), (0.55, -1.2, 0.2 + k * 0.17), m.bright))
    for s in (-1, 1):
        o.append(eisen.box(f'rail{s}', (0.03, 0.03, 1.6), (0.55 + s * 0.15, -1.22, 0.85), m.bright))
    # Anschlüsse an den Ecken
    z = PIPE_Z
    for (cx, cy, dx, dy) in ((-1, 1, 0, 1), (-1, 1, -1, 0), (1, -1, 0, -1), (1, -1, 1, 0)):
        a = (cx, cy, z)
        b = (cx + dx * 0.55, cy + dy * 0.55, z)
        o.append(pipe(f'port{cx}{dx}{dy}', a, b, PIPE_R, m.pipe, 20))
        flange(o, f'pf{cx}{dx}{dy}', (cx + dx * 0.47, cy + dy * 0.47, z), 'Y' if dy else 'X', m)
    return eisen.parent_all(o, 'tank')


def steel_furnace(m, fire=0.0):
    """Stahlofen 2×2: Stahlgehäuse mit Ziegelausmauerung, Feuertür (Süden), Schornstein."""
    o = []
    o.append(eisen.box('base', (1.9, 1.9, 0.12), (0, 0, 0.06), m.dark, bevel=0.02))
    o.append(eisen.box('body', (1.7, 1.6, 0.9), (0, 0.05, 0.57), m.steel, bevel=0.06))
    o.append(eisen.box('lining', (1.5, 1.42, 0.12), (0, 0.05, 1.05), m.brick, bevel=0.03))
    o.append(eisen.box('top', (1.74, 1.64, 0.06), (0, 0.05, 1.0), m.dark, bevel=0.01))
    for x in (-0.6, 0.0, 0.6):
        o.append(eisen.box(f'rib{x}', (0.08, 1.66, 0.85), (x, 0.05, 0.55), m.dark, bevel=0.01))
    o.append(eisen.box('door', (0.6, 0.06, 0.42), (0, -0.78, 0.38), m.dark, bevel=0.02))
    glow = eisen.emission_material('sfire', (1.0, 0.4, 0.1), 1.5 + 12.0 * fire)
    o.append(eisen.box('slit', (0.44, 0.02, 0.12), (0, -0.82, 0.3), glow))
    if fire > 0:
        light = bpy.data.lights.new('sfire', 'POINT')
        light.energy = 25 * fire
        light.color = (1.0, 0.5, 0.2)
        lo = bpy.data.objects.new('sfire', light)
        lo.location = (0, -1.0, 0.3)
        eisen.link(lo)
    o.append(eisen.cylinder('stack', 0.16, 0.8, (0.45, 0.4, 1.4), m.dark, segments=20))
    o.append(eisen.cylinder('stackcap', 0.2, 0.06, (0.45, 0.4, 1.82), m.rust, segments=20))
    o.append(eisen.box('vent', (0.5, 0.3, 0.1), (-0.4, 0.3, 1.13), m.dark, bevel=0.02))
    bolts(o, m.bright, [(x, -0.76) for x in (-0.75, -0.4, 0.4, 0.75)], 0.85, 0.02, 'Y')
    return eisen.parent_all(o, 'sfurnace')


MEDIUM_TOP = 2.4
BIG_TOP = 3.6


def medium_pole(m):
    """Mittlerer Strommast: Stahlrohrmast mit zwei Querträgern und vier Isolatoren."""
    o = []
    o.append(eisen.box('foot', (0.34, 0.34, 0.1), (0, 0, 0.05), m.concrete, bevel=0.02))
    o.append(eisen.cylinder('mast', 0.06, MEDIUM_TOP, (0, 0, MEDIUM_TOP / 2 + 0.05), m.steel, segments=12))
    for z, w in ((MEDIUM_TOP - 0.1, 0.7), (MEDIUM_TOP - 0.45, 0.5)):
        o.append(eisen.box(f'cross{z}', (w, 0.06, 0.05), (0, 0, z), m.paint, bevel=0.01))
        for s in (-1, 1):
            for k in range(3):
                o.append(eisen.cylinder(f'ins{z}{s}{k}', 0.04 - k * 0.005, 0.03, (s * (w / 2 - 0.04), 0, z + 0.05 + k * 0.035), m.insul, segments=10))
    for s in (-1, 1):
        o.append(beam(f'brace{s}', (s * 0.15, 0, 0.1), (0, 0, 0.8), (0.03, 0.03), m.dark))
    return eisen.parent_all(o, 'mpole')


def big_pole(m):
    """Großer Strommast 2×2: Gittermast mit breitem Kopf und Isolatorketten."""
    o = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'foot{sx}{sy}', (0.25, 0.25, 0.12), (sx * 0.6, sy * 0.6, 0.06), m.concrete, bevel=0.02))
            o.append(beam(f'leg{sx}{sy}', (sx * 0.6, sy * 0.6, 0.1), (sx * 0.14, sy * 0.14, BIG_TOP), (0.06, 0.06), m.steel))
    for k in range(6):
        z = 0.4 + k * 0.52
        r = 0.6 - (z / BIG_TOP) * 0.46
        for sy in (-1, 1):
            o.append(beam(f'bx{k}{sy}', (-r, sy * r, z), (r, sy * r, z + 0.5), (0.025, 0.025), m.dark))
            o.append(beam(f'by{k}{sy}', (sy * r, -r, z), (sy * r, r, z + 0.5), (0.025, 0.025), m.dark))
    o.append(eisen.box('head', (1.3, 0.12, 0.1), (0, 0, BIG_TOP - 0.05), m.paint, bevel=0.01))
    for s in (-1, 0, 1):
        for k in range(4):
            o.append(eisen.cylinder(f'ins{s}{k}', 0.045, 0.035, (s * 0.55, 0, BIG_TOP - 0.15 - k * 0.05), m.insul, segments=10))
    return eisen.parent_all(o, 'bpole')


def lamp(m, on=0.0):
    """Lampe: kurzer Mast mit Glaskolben; on > 0 lässt den Kolben leuchten."""
    o = []
    o.append(eisen.box('base', (0.36, 0.36, 0.1), (0, 0, 0.05), m.dark, bevel=0.02))
    o.append(eisen.cylinder('post', 0.06, 0.45, (0, 0, 0.32), m.steel, segments=12))
    o.append(eisen.cylinder('ring', 0.14, 0.05, (0, 0, 0.56), m.dark, segments=20))
    bulb = eisen.material('bulb', eisen.srgb('#d9d2b4'), rough=0.2) if on <= 0 else eisen.emission_material('bulbon', (1.0, 0.9, 0.65), 6.0 * on)
    o.append(eisen.cylinder('glass', 0.12, 0.2, (0, 0, 0.7), bulb, segments=20, bevel=0.06))
    o.append(eisen.cylinder('cap', 0.13, 0.05, (0, 0, 0.82), m.dark, segments=20, bevel=0.01))
    if on > 0:
        light = bpy.data.lights.new('lamp', 'POINT')
        light.energy = 40 * on
        light.color = (1.0, 0.9, 0.7)
        lo = bpy.data.objects.new('lamp', light)
        lo.location = (0, 0, 0.75)
        eisen.link(lo)
    return eisen.parent_all(o, 'lamp')


def wooden_chest(m):
    wood = gw_ground.pmat('a_wood', lin('#7a5a38'), 0.85, 0.35, 0.5, 30)
    o = []
    for k in range(4):
        o.append(eisen.box(f'plank{k}', (0.8, 0.19, 0.5), (0, -0.29 + k * 0.195, 0.25), wood, bevel=0.015))
    o.append(eisen.box('lid', (0.84, 0.8, 0.08), (0, 0, 0.54), wood, bevel=0.02))
    for s in (-1, 1):
        o.append(eisen.box(f'band{s}', (0.86, 0.06, 0.6), (0, s * 0.25, 0.3), m.dark, bevel=0.005))
    o.append(eisen.box('lock', (0.08, 0.02, 0.08), (0, -0.41, 0.48), m.brass, bevel=0.005))
    return eisen.parent_all(o, 'wchest')


def steel_chest(m):
    o = []
    body = bauten.weathered('a_schest', '#6d7378', metal=0.85, rough=0.38, rust=0.2, dust=0.4, edge=0.5, streaks=0.3)
    o.append(eisen.box('body', (0.84, 0.8, 0.52), (0, 0, 0.26), body, bevel=0.03))
    o.append(eisen.box('lid', (0.88, 0.84, 0.1), (0, 0, 0.57), body, bevel=0.03))
    for k in range(3):
        o.append(eisen.box(f'rib{k}', (0.9, 0.04, 0.03), (0, -0.25 + k * 0.25, 0.63), m.dark))
    o.append(eisen.box('handle', (0.24, 0.03, 0.05), (0, -0.43, 0.42), m.bright, bevel=0.008))
    bolts(o, m.bright, [(x, -0.405) for x in (-0.33, 0.33)], 0.15, 0.015, 'Y')
    return eisen.parent_all(o, 'schest')


def wood_logs(m):
    bark = gw_ground.pmat('a_bark', lin('#5a4330'), 0.95, 0.4, 0.7, 25)
    end = gw_ground.pmat('a_endgrain', lin('#b08a5a'), 0.8, 0.2, 0.3, 20)
    o = []
    for k, (x, z) in enumerate(((-0.13, 0.11), (0.13, 0.11), (0, 0.32))):
        o.append(eisen.cylinder(f'log{k}', 0.12, 0.7, (x, 0, z), bark, segments=16, rot=(math.pi / 2, 0, 0)))
        for s in (-1, 1):
            o.append(eisen.cylinder(f'end{k}{s}', 0.115, 0.01, (x, s * 0.35, z), end, segments=16, rot=(math.pi / 2, 0, 0)))
    return eisen.parent_all(o, 'logs')


def steel_plates(m):
    st = bauten.weathered('a_steelplate', '#8c9399', metal=0.95, rough=0.28, rust=0.05, dust=0.15, edge=0.3, grime=0.15)
    o = [eisen.box('p1', (0.7, 0.5, 0.07), (0, 0, 0.035), st, bevel=0.015),
         eisen.box('p2', (0.7, 0.5, 0.07), (0.04, 0.05, 0.11), st, bevel=0.015)]
    root = eisen.parent_all(o, 'steel')
    root.rotation_euler = (0, 0, math.radians(20))
    return root


def engine_unit(m):
    o = []
    o.append(eisen.cylinder('block', 0.2, 0.55, (0, 0, 0.22), m.dark, segments=24, rot=(0, math.pi / 2, 0), bevel=0.03))
    for k in range(4):
        o.append(eisen.cylinder(f'cyl{k}', 0.08, 0.2, (-0.2 + k * 0.13, 0, 0.45), m.steel, segments=12, bevel=0.02))
    o.append(eisen.cylinder('flywheel', 0.17, 0.06, (0.32, 0, 0.22), m.brass, segments=24, rot=(0, math.pi / 2, 0)))
    o.append(pipe('exhaust', (-0.3, 0.1, 0.3), (-0.42, 0.25, 0.45), 0.03, m.rust))
    return eisen.parent_all(o, 'engine')


def landfill_pile(m, rnd_seed=5):
    import random as _r
    rnd = _r.Random(rnd_seed)
    earth = gw_ground.pmat('a_landfill', lin('#7a6650'), 1.0, 0.35, 0.6, 18)
    stone = gw_ground.pmat('a_lfstone', lin('#8a8070'), 0.9, 0.35, 0.6, 12)
    o = [eisen.cylinder('heap', 0.38, 0.2, (0, 0, 0.1), earth, segments=24, bevel=0.09)]
    o.extend(bauten.stones(14, rnd, [stone], lambda x, y: x * x + y * y < 0.9, (0.04, 0.08), z0=0.15))
    for s in o[1:]:
        s.location.x *= 0.35
        s.location.y *= 0.35
    return eisen.parent_all(o, 'landfill')
