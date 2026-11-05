"""Stufe 1 „Notbau“ (docs/ART_STYLE.md): Brennstoff-Bohrer, Kessel, Labor neu; Dampfmaschine, Uferpumpe und
Steinofen mit Stufe-1-Materialien und Zusatzdetails. Anschlüsse, Rauchpunkte (src/data/fx.ts) und Leinwände wie bisher.
"""
import math
import random

import anlagen
import bauten
import bpy
import eisen
import gw_ground
import kit
import parts
from anlagen import PIPE_R, PIPE_Z, flange
from bauten import beam, pipe

lin = gw_ground.lin


class T1Mats(anlagen.Mats):
    """anlagen.Mats mit Stufe-1-Materialien: bestehende Modelle sehen damit nach Notbau aus."""

    def __init__(self, accent='#6f5f34', prefix='s1'):
        super().__init__()
        t = kit.Tier(1, accent=accent, prefix=prefix)
        self.t = t
        self.steel = t.metal
        self.dark = t.frame
        self.paint = t.panels[0]
        self.green = t.panels[2]
        self.red = t.panels[1]
        self.pipe = bauten.weathered(prefix + 'pipe', '#555149', metal=0.7, rough=0.5, rust=0.6, dust=0.3, edge=0.5, streaks=0.6)
        self.bright = bauten.weathered(prefix + 'bright', '#77746c', metal=0.85, rough=0.4, rust=0.3, dust=0.25, edge=0.4)
        self.copper = bauten.weathered(prefix + 'cu', '#8e5a37', metal=0.85, rough=0.4, rust=0.35, dust=0.3, edge=0.5, rust_hex='#4f7a62')


def _spoil(o, seed, inside, n=90, size=(0.025, 0.06), scale=1.0):
    rnd = random.Random(seed)
    earth = [gw_ground.pmat(f'sp{seed}{i}', lin(h), 1.0, 0.3, 0.6, 25) for i, h in enumerate(['#4f3f2e', '#5d4a35', '#6b6458', '#3e3226'])]
    st = bauten.stones(n, rnd, earth, inside, size)
    for s in st:
        s.location.x *= scale
        s.location.y *= scale
    o.extend(st)


# --------------------------------------------------------------------------- Brennstoff-Bohrer 2×2

def drill1(_m=None, phase=0.0, working=True):
    """Schrott-Bohrturm: Kufen aus Trägern, Flickenblech-Gehäuse, offener Schacht mit drehendem Bohrkopf-Zahnrad,
    Feuerklappe nach Süden, Schornstein hinten rechts (Rauchpunkt 0.55/0.35/1.42), Rutsche nach Norden links."""
    m = T1Mats(prefix='d1')
    t = m.t
    rnd = kit.rng(11)
    o = []
    # Kufen und Bodenrahmen
    for s in (-1, 1):
        kit.ibeam(o, f'skid{s}', (-0.95, s * 0.72, 0.07), (0.95, s * 0.72, 0.07), 0.12, 0.12, t.frame)
    kit.plate(o, 'floor', (1.7, 1.6, 0.04), (0, 0, 0.15), t.frame)
    # Gehäuse aus Flickenblechen (H bis 0.78)
    H = 0.78
    kit.wall_panels(o, 'X', -0.78, -0.78, 0.78, 0.17, H, 3, t.panels, rnd, jitter=0.6, outward=-1)
    kit.wall_panels(o, 'X', 0.72, -0.78, 0.78, 0.17, H, 3, t.panels, rnd, jitter=0.6)
    kit.wall_panels(o, 'Y', -0.8, -0.72, 0.72, 0.17, H, 3, t.panels, rnd, jitter=0.6, outward=-1)
    kit.wall_panels(o, 'Y', 0.8, -0.72, 0.72, 0.17, H, 3, t.panels, rnd, jitter=0.6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            kit.plate(o, f'corner{sx}{sy}', (0.07, 0.07, H + 0.06), (sx * 0.8, sy * 0.76, 0.17 + (H + 0.06) / 2), t.frame)
    # Dach: Flicken links, Wellblech rechts hinten, offener Schacht vorne links
    Z = H + 0.17
    kit.plate(o, 'roofrim', (1.66, 1.6, 0.04), (0, -0.01, Z), t.frame)
    kit.paneled_top(o, 0.05, -0.78, 0.82, 0.05, Z + 0.02, 1, 2, t.panels, rnd, gap=0.02, thick=0.03, jitter=0.03, bolts_mat=t.metal)
    o.append(kit.corrugated('corr', 0.8, 0.75, 4, 0.025, (0.42, 0.42, Z + 0.06), t.corr, rot=(0.05, -0.04, 0.02)))
    # Schacht mit Bohrkopf (dreht sich) und Kolben
    sx, sy = -0.38, -0.2
    o.append(eisen.box('shaft', (0.72, 0.9, 0.05), (sx, sy, Z + 0.02), t.inner))
    for s in (-1, 1):
        kit.plate(o, f'shx{s}', (0.8, 0.06, 0.1), (sx, sy + s * 0.46, Z + 0.06), t.frame)
        kit.plate(o, f'shy{s}', (0.06, 0.95, 0.1), (sx + s * 0.38, sy, Z + 0.06), t.frame)
    a = phase * math.tau
    g = bauten.gear('dgear', 0.27, 0.22, 10, 0.05, t.metal)
    g.location = (sx, sy + 0.1, Z + 0.06)
    g.rotation_euler = (0, 0, a)
    o.append(g)
    o.append(eisen.cylinder('dhub', 0.07, 0.1, (sx, sy + 0.1, Z + 0.1), t.dark, segments=12))
    for k in range(3):
        b = a + k / 3 * math.tau
        o.append(beam(f'dspk{k}', (sx, sy + 0.1, Z + 0.1), (sx + math.cos(b) * 0.2, sy + 0.1 + math.sin(b) * 0.2, Z + 0.1), (0.03, 0.02), t.accent))
    pz = 0.05 * math.sin(a * 2)
    o.append(eisen.cylinder('piston', 0.06, 0.3, (sx + 0.18, sy - 0.32, Z + 0.15 + pz), t.metal, segments=12))
    o.append(eisen.cylinder('pistonhead', 0.08, 0.04, (sx + 0.18, sy - 0.32, Z + 0.31 + pz), t.dark, segments=12))
    # Schornstein (Rauchpunkt) mit Rußkappe
    o.append(eisen.cylinder('stack', 0.1, 0.6, (0.55, 0.35, 1.08), t.metal, segments=14))
    o.append(eisen.cylinder('stackband', 0.115, 0.05, (0.55, 0.35, 1.0), t.frame, segments=14))
    o.append(eisen.cylinder('stacktop', 0.13, 0.05, (0.55, 0.35, 1.39), t.dark, segments=14))
    o.append(eisen.cylinder('stacksoot', 0.08, 0.01, (0.55, 0.35, 1.42), eisen.material('d1soot', (0.008, 0.008, 0.008), rough=1), segments=12))
    # Feuerklappe Süd mit Glut
    kit.plate(o, 'hatch', (0.42, 0.04, 0.26), (0.35, -0.82, 0.42), t.dark)
    o.append(eisen.box('hatchglow', (0.3, 0.02, 0.05), (0.35, -0.85, 0.36), eisen.emission_material('d1ember', (1.0, 0.35, 0.08), 3.0 if working else 0.0)))
    kit.plate(o, 'coalbox', (0.3, 0.18, 0.14), (-0.45, -0.88, 0.26), t.wood, rot=(0, 0, 0.1))
    # Ausgaberutsche nach Norden über der linken Hälfte
    o.append(eisen.box('chute', (0.42, 0.5, 0.16), (-0.35, 0.82, 0.32), t.panels[1], bevel=0.01, rot=(math.radians(-18), 0, 0)))
    o.append(eisen.box('chuteIn', (0.3, 0.46, 0.05), (-0.35, 0.84, 0.39), t.inner, rot=(math.radians(-18), 0, 0)))
    kit.cable(o, 'hose', [(0.78, -0.4, Z - 0.1), (0.95, -0.2, 0.4), (0.82, 0.2, 0.2)], 0.018, t.rubber)
    _spoil(o, 41, lambda x, y: (0.9 < max(abs(x), abs(y)) < 0.99) and not (y > 0.85 and -0.6 < x < -0.1))
    return eisen.parent_all(o, 'drill')


# --------------------------------------------------------------------------- Kessel 3×2

def boiler1(_m=None, fire=0.0):
    """Genieteter Kessel auf gemauerter Feuerung mit Blechverkleidung. Anschlüsse wie anlagen.boiler:
    Dampf Mitte Nord, Wasser an beiden Enden (Süd-Reihe y=-0.5), Schornstein (-0.85/-0.55, oben 1.82)."""
    m = T1Mats(prefix='b1')
    t = m.t
    rnd = kit.rng(12)
    o = []
    o.append(eisen.box('firebox', (2.5, 1.5, 0.5), (0, -0.1, 0.25), m.brick, bevel=0.03))
    kit.wall_panels(o, 'X', -0.86, -1.2, 1.2, 0.04, 0.55, 5, t.panels, rnd, jitter=0.5, outward=-1, thick=0.03)
    kit.plate(o, 'fireframe', (2.58, 1.58, 0.05), (0, -0.1, 0.53), t.frame)
    kit.plate(o, 'door', (0.5, 0.05, 0.3), (0, -0.9, 0.28), t.dark)
    glow = eisen.emission_material('b1fire', (1.0, 0.38, 0.1), 2.0 + 10.0 * fire)
    o.append(eisen.box('doorglow', (0.36, 0.02, 0.08), (0, -0.935, 0.2), glow))
    for k in range(5):
        o.append(eisen.box(f'grate{k}', (0.02, 0.02, 0.24), (-0.16 + k * 0.08, -0.94, 0.3), t.metal))
    if fire > 0:
        light = bpy.data.lights.new('b1light', 'POINT')
        light.energy = 30 * fire
        light.color = (1.0, 0.5, 0.2)
        lo = bpy.data.objects.new('b1light', light)
        lo.location = (0, -1.08, 0.25)
        eisen.link(lo)
    # Trommel aus Blechschüssen mit Nietreihen, aufgeschweißte Flicken, Isolierung teils abgerissen
    o.append(eisen.cylinder('drum', 0.5, 2.2, (0, 0.05, 0.98), t.panels[2], segments=40, rot=(0, math.pi / 2, 0), bevel=0.02))
    for x in (-0.75, 0.0, 0.75):
        o.append(eisen.cylinder(f'seam{x}', 0.508, 0.03, (x, 0.05, 0.98), t.frame, segments=40, rot=(0, math.pi / 2, 0)))
        for k in range(14):
            b = k / 14 * math.pi
            o.append(eisen.cylinder(f'rv{x}{k}', 0.012, 0.02, (x + 0.03, 0.05 + math.cos(b) * 0.51, 0.98 + math.sin(b) * 0.51), t.metal, segments=6, rot=(0, math.pi / 2, 0)))
    tarp = eisen.cylinder('wrap', 0.515, 0.6, (-0.4, 0.05, 0.98), t.tarp, segments=40, rot=(0, math.pi / 2, 0))
    o.append(tarp)
    for k in range(3):
        b = rnd.uniform(0.2, 2.9)
        p = kit.plate(o, f'dpatch{k}', (rnd.uniform(0.2, 0.35), 0.2, 0.02), (rnd.uniform(0.2, 0.9), 0.05 + math.cos(b) * 0.51, 0.98 + math.sin(b) * 0.51),
                      t.panels[rnd.randrange(4)], rot=(b - math.pi / 2, 0, rnd.uniform(-0.2, 0.2)))
    for s in (-1, 1):
        o.append(eisen.cylinder(f'endcap{s}', 0.46, 0.07, (s * 1.12, 0.05, 0.98), t.frame, segments=40, rot=(0, math.pi / 2, 0), bevel=0.02))
        o.append(eisen.cylinder(f'manhole{s}', 0.16, 0.05, (s * 1.16, 0.05, 1.0), t.metal, segments=20, rot=(0, math.pi / 2, 0), bevel=0.01))
    # Dampfdom, Sicherheitsventil, Manometer, Dampfleitung nach Norden
    o.append(eisen.cylinder('dome', 0.2, 0.3, (0, 0.2, 1.55), t.accent, segments=24, bevel=0.03))
    o.append(eisen.cylinder('valve', 0.05, 0.22, (0.35, 0.05, 1.57), m.bright, segments=12))
    o.append(eisen.cylinder('valvew', 0.08, 0.03, (0.35, 0.05, 1.69), t.dark, segments=12))
    o.append(eisen.cylinder('gauge', 0.08, 0.03, (0.6, -0.47, 1.12), m.insul, segments=16, rot=(math.pi / 2, 0, 0)))
    o.append(eisen.cylinder('gaugeR', 0.09, 0.02, (0.6, -0.465, 1.12), t.dark, segments=16, rot=(math.pi / 2, 0, 0)))
    o.append(pipe('steam', (0, 0.2, 1.6), (0, 0.75, 1.6), PIPE_R * 0.9, m.pipe, 20))
    o.append(pipe('steamdown', (0, 0.75, 1.6), (0, 0.75, PIPE_Z), PIPE_R * 0.9, m.pipe, 20))
    o.append(pipe('steamout', (0, 0.75, PIPE_Z), (0, 1.03, PIPE_Z), PIPE_R, m.pipe, 20))
    flange(o, 'fls', (0, 0.97, PIPE_Z), 'Y', m)
    for s in (-1, 1):
        o.append(pipe(f'win{s}', (s * 1.0, -0.5, PIPE_Z), (s * 1.53, -0.5, PIPE_Z), PIPE_R, m.pipe, 20))
        flange(o, f'flw{s}', (s * 1.47, -0.5, PIPE_Z), 'X', m)
        o.append(pipe(f'wup{s}', (s * 1.05, -0.5, PIPE_Z), (s * 1.05, -0.1, 0.75), PIPE_R * 0.7, m.pipe))
    # Schornstein aus Rohrstücken
    o.append(eisen.cylinder('stack', 0.14, 1.2, (-0.85, -0.55, 1.15), m.pipe, segments=20))
    for z in (0.8, 1.25):
        o.append(eisen.cylinder(f'stackband{z}', 0.155, 0.05, (-0.85, -0.55, z), t.frame, segments=20))
    o.append(eisen.cylinder('stacktop', 0.18, 0.07, (-0.85, -0.55, 1.78), t.dark, segments=20))
    o.append(eisen.cylinder('stacksoot', 0.12, 0.01, (-0.85, -0.55, 1.82), eisen.material('b1soot', (0.008, 0.008, 0.008), rough=1), segments=16))
    # Kohle- und Aschehaufen vor der Feuertür, Schaufel
    soot = [gw_ground.pmat(f'b1s{i}', lin(h), 1.0, 0.3, 0.6, 25) for i, h in enumerate(['#2a2420', '#3d3328', '#4a3e30'])]
    o.extend(bauten.stones(36, random.Random(5), soot, lambda x, y: y < -0.9 and abs(x) < 0.65, (0.02, 0.045)))
    o.append(beam('shovel', (0.75, -0.95, 0.06), (1.1, -0.75, 0.1), (0.025, 0.02), t.wood))
    return eisen.parent_all(o, 'boiler')


# --------------------------------------------------------------------------- Dampfmaschine 3×5

def steam_engine1(_m=None, phase=0.0):
    """anlagen.steam_engine mit Stufe-1-Materialien, Holzbohlen, Schutzgeländer, Ölfässern und Kabel."""
    m = T1Mats(prefix='e1')
    t = m.t
    m.concrete = t.wood
    root = anlagen.steam_engine(m, phase)
    rnd = kit.rng(13)
    o = []
    for k in range(9):
        y = -2.2 + k * 0.55
        kit.plate(o, f'plank{k}', (2.5, 0.5, 0.05), (rnd.uniform(-0.02, 0.02), y, 0.0), t.wood, rot=(0, 0, rnd.uniform(-0.015, 0.015)))
    kit.railing(o, [(1.15, -2.25, 0.22), (1.15, 2.25, 0.22)], 0.3, t.accent, post_every=0.6)
    kit.plate(o, 'hazard', (0.04, 1.8, 0.03), (1.08, -1.1, 0.235), t.hazard, bevel=0.0)
    for k, (x, y) in enumerate(((-0.95, -0.4), (-0.95, -0.1))):
        o.append(eisen.cylinder(f'drum{k}', 0.13, 0.32, (x, y, 0.38), t.panels[k + 1], segments=18))
        o.append(eisen.cylinder(f'drumtop{k}', 0.12, 0.01, (x, y, 0.545), t.dark, segments=18))
    kit.cable(o, 'gencable', [(-0.25, -1.9, 1.12), (-0.8, -2.0, 0.9), (-1.15, -2.3, 0.25)], 0.022, t.rubber)
    kit.plate(o, 'toolbox', (0.3, 0.16, 0.12), (-0.95, 1.9, 0.29), t.accent, rot=(0, 0, 0.3))
    for ob in o:
        ob.parent = root
    return root


# --------------------------------------------------------------------------- Uferpumpe 1×2 (Ursprung zwischen den Feldern)

def offshore_pump1(_m=None, phase=0.0):
    m = T1Mats(prefix='p1')
    root = anlagen.offshore_pump(m, phase)
    o = []
    t = m.t
    kit.plate(o, 'deckwood', (0.74, 0.5, 0.03), (0, -0.62, 0.245), t.wood)
    kit.cable(o, 'cab', [(0, -0.15, 0.85), (0.25, 0.1, 0.6), (0.3, 0.4, 0.25)], 0.014, t.rubber)
    for ob in o:
        ob.parent = root
    return root


# --------------------------------------------------------------------------- Steinofen 2×2

def furnace1(_m=None, fire=0.0, seed=3):
    """parts.furnace mit eiserner Deckplatte, Bandeisen und Blechrohr als Rauchabzug (Rauchpunkt 0.25/0.25/1.42)."""
    pm = parts.Mats()
    root, fire_objs = parts.furnace(pm, fire, seed)
    t = kit.Tier(1, accent='#6f5f34', prefix='f1')
    o = []
    kit.plate(o, 'ironcap', (1.36, 1.36, 0.04), (0, 0.05, 1.07), t.metal, bevel=0.01)
    kit.paneled_top(o, -0.66, -0.61, 0.66, 0.71, 1.09, 2, 2, t.panels[:3], kit.rng(seed), gap=0.03, thick=0.02, jitter=0.02, bolts_mat=t.metal)
    for s in (-1, 1):
        kit.plate(o, f'band{s}', (1.78, 0.03, 0.06), (0, s * 0.89, 0.62), t.frame, bevel=0.0)
        kit.plate(o, f'bandx{s}', (0.03, 1.78, 0.06), (s * 0.89, 0, 0.62), t.frame, bevel=0.0)
    o.append(eisen.cylinder('flue2', 0.15, 0.32, (0.25, 0.25, 1.26), t.metal, segments=16))
    o.append(eisen.cylinder('flueband', 0.165, 0.04, (0.25, 0.25, 1.2), t.frame, segments=16))
    o.append(eisen.cylinder('fluetop', 0.17, 0.04, (0.25, 0.25, 1.41), t.dark, segments=16))
    o.append(eisen.cylinder('fluesoot', 0.11, 0.01, (0.25, 0.25, 1.432), eisen.material('f1soot', (0.008, 0.008, 0.008), rough=1), segments=14))
    for ob in o:
        ob.parent = root
    return root, fire_objs


# --------------------------------------------------------------------------- Labor 3×3

def lab1(_m=None, phase=0.0):
    """Behelfslabor: Plattform aus Flickenblech, Glaszylinder im Stahlkäfig mit drehendem Probenring,
    Arbeitstische mit Kolben, Schaltkasten mit Anzeige, Antenne."""
    t = kit.Tier(1, accent='#7a6a3a', prefix='l1')
    rnd = kit.rng(14)
    o = []
    o.append(eisen.cylinder('base', 1.4, 0.16, (0, 0, 0.08), t.frame, segments=8, bevel=0.02, rot=(0, 0, math.pi / 8)))
    kit.paneled_top(o, -1.15, -1.15, 1.15, 1.15, 0.16, 3, 3, t.panels, rnd, gap=0.025, thick=0.03, jitter=0.02, bolts_mat=t.metal)
    # Kernsockel und Glaszylinder
    o.append(eisen.cylinder('plinth', 0.72, 0.3, (0, 0.1, 0.35), t.panels[2], segments=24, bevel=0.03))
    o.append(eisen.cylinder('plinthband', 0.74, 0.05, (0, 0.1, 0.48), t.frame, segments=24))
    gl = eisen.material('l1glass', eisen.srgb('#a8d6d2'), rough=0.03, metal=0.0)
    b = gl.node_tree.nodes['Principled BSDF']
    b.inputs['Transmission Weight'].default_value = 0.85
    b.inputs['Alpha'].default_value = 0.5
    o.append(eisen.cylinder('core', 0.12, 0.7, (0, 0.1, 0.85), t.metal, segments=16))
    a = phase * math.tau
    o.append(eisen.cylinder('ring', 0.48, 0.04, (0, 0.1, 0.8), t.accent, segments=32))
    cols = ['#e2402e', '#4ccf5a', '#f0c23a', '#4f86f0']
    for k in range(8):
        bb = a + k / 8 * math.tau
        o.append(eisen.cylinder(f'vial{k}', 0.045, 0.16, (math.cos(bb) * 0.42, 0.1 + math.sin(bb) * 0.42, 0.9), kit.glow(f'l1v{k}', cols[k % 4], 2.5), segments=10))
    o.append(eisen.cylinder('glass', 0.6, 0.72, (0, 0.1, 0.86), gl, segments=40))
    for k in range(6):
        bb = k / 6 * math.tau + 0.3
        o.append(pipe(f'cage{k}', (math.cos(bb) * 0.62, 0.1 + math.sin(bb) * 0.62, 0.5), (math.cos(bb) * 0.62, 0.1 + math.sin(bb) * 0.62, 1.22), 0.022, t.frame, 6))
    # offener Deckelring mit Querstreben (Blick auf den Probenring)
    lid = eisen.cylinder('lid', 0.66, 0.07, (0, 0.1, 1.25), t.frame, segments=32)
    cut = eisen.cylinder('lidcut', 0.5, 0.3, (0, 0.1, 1.25), t.frame, segments=32)
    mod = lid.modifiers.new('hole', 'BOOLEAN')
    mod.object = cut
    mod.operation = 'DIFFERENCE'
    cut.hide_render = True
    cut.parent = lid
    cut.location = (0, 0, 0)
    o.append(lid)
    for k in range(2):
        bb = k * math.pi / 2 + 0.4
        o.append(beam(f'strut{k}', (math.cos(bb) * 0.6, 0.1 + math.sin(bb) * 0.6, 1.28), (-math.cos(bb) * 0.6, 0.1 - math.sin(bb) * 0.6, 1.28), (0.05, 0.04), t.panels[k]))
    o.append(eisen.cylinder('lidhub', 0.1, 0.1, (0.0, 0.1, 1.3), t.metal, segments=16))
    # Arbeitstische mit Kolben (Ost und West), Schaltkasten Süd
    for s in (-1, 1):
        kit.plate(o, f'bench{s}', (0.32, 1.1, 0.05), (s * 1.05, 0.1, 0.5), t.wood)
        for yy in (-0.35, 0.55):
            kit.plate(o, f'leg{s}{yy}', (0.04, 0.04, 0.3), (s * 1.05, yy, 0.33), t.frame, bevel=0.0)
        for k in range(3):
            o.append(eisen.cylinder(f'flask{s}{k}', 0.05, 0.12, (s * 1.05, -0.2 + k * 0.3, 0.58), kit.glow(f'l1f{s}{k}', cols[(k + (s > 0)) % 4], 0.5), segments=10))
    kit.plate(o, 'box', (0.5, 0.22, 0.38), (0.55, -1.0, 0.37), t.accent)
    o.append(eisen.box('screen', (0.3, 0.015, 0.14), (0.55, -1.115, 0.44), kit.glow('l1scr', '#8fe0b0', 2.0)))
    kit.cable(o, 'cab1', [(0.55, -0.9, 0.56), (0.35, -0.6, 0.6), (0.0, -0.5, 0.45)], 0.018, t.rubber)
    o.append(eisen.cylinder('ant', 0.015, 0.7, (-0.85, -0.85, 0.55), t.metal, segments=8))
    o.append(eisen.cylinder('anttip', 0.03, 0.03, (-0.85, -0.85, 0.9), kit.glow('l1ant', '#ff6a3a', 4.0), segments=8))
    kit.plate(o, 'crate', (0.32, 0.32, 0.22), (-0.8, 0.85, 0.29), t.wood, rot=(0, 0, 0.25))
    return eisen.parent_all(o, 'lab')
