"""Kleinteile im Stil „Endzeit-Industrie“ (docs/ART_STYLE.md): Greifarme, Kisten, Rohre, Masten,
Untergrundband und Splitter. Diese Teile stehen in jeder Fabrik zu Hunderten – sie sollen aus der Nähe
Einzelheiten zeigen (Schrauben, Nähte, Schläuche, Warnstreifen), aus der Ferne aber ruhig und gut lesbar bleiben.

Maße in Feldern, Richtung Nord (+Y), Ursprung in der Feldmitte. Höhen der Kabelpunkte und des Greifers
bleiben wie in anlagen.py/parts.py (das Spiel liest sie aus dem Manifest).
"""
import math
import random

import bauten
import eisen
import gw_ground
import kit
from anlagen import BIG_TOP, DIRV, MEDIUM_TOP, PIPE_R, PIPE_Z, POLE_TOP
from bauten import beam, bolts, pipe
from mathutils import Vector

lin = gw_ground.lin
W = bauten.weathered


class Mats:
    """Materialsatz der Kleinteile; paint = Erkennungsfarbe (Stufe des Greifarms/Bands)."""

    def __init__(self, paint='#7d6231', level=1):
        self.level = level
        self.paint = W('k_paint', paint, metal=0.3, rough=0.55, rust=0.45 if level == 1 else 0.25, dust=0.4,
                       edge=0.45, streaks=0.35)
        self.paint2 = W('k_paint2', kit.shade(paint, 0.78), metal=0.3, rough=0.6, rust=0.4, dust=0.45, edge=0.6, streaks=0.4)
        self.steel = W('k_steel', '#55564f', metal=0.75, rough=0.48, rust=0.4, dust=0.45, edge=0.55, streaks=0.4)
        self.dark = W('k_dark', '#272725', metal=0.6, rough=0.58, rust=0.3, dust=0.45, edge=0.4)
        self.bright = W('k_bright', '#8c8e88', metal=0.9, rough=0.3, rust=0.1, dust=0.25, edge=0.3)
        self.rust = W('k_rust', '#6b3c1f', metal=0.2, rough=0.85, rust=0.7, dust=0.3, edge=0.2)
        self.rubber = W('k_rubber', '#1e1d1b', metal=0.0, rough=0.85, rust=0.0, dust=0.4, edge=0.0)
        self.brass = W('k_brass', '#8f7440', metal=0.85, rough=0.38, rust=0.15, dust=0.35, edge=0.6, rust_hex='#4b5a40')
        self.hazard = kit.hazard('k_haz', wear=0.9 if level == 1 else 0.5, scale=11.0)
        self.concrete = gw_ground.pmat('k_conc', lin('#8a8479'), 0.95, 0.3, 0.5, 22)
        self.insul = eisen.material('k_insul', eisen.srgb('#cdc5ae'), rough=0.25)
        self.soot = eisen.material('k_soot', eisen.srgb('#141312'), rough=0.9)
        self.seam = eisen.material('k_seam', (0.012, 0.011, 0.01), rough=0.9)


def ring_bolts(o, mat, center, r, n, axis, size=0.014, name='rb'):
    """n Schrauben auf einem Kreis (Flansch) senkrecht zu axis."""
    cx, cy, cz = center
    for i in range(n):
        a = i / n * math.tau + math.pi / n
        if axis == 'Y':
            p, rot = (cx + math.cos(a) * r, cy, cz + math.sin(a) * r), (math.pi / 2, 0, 0)
        elif axis == 'X':
            p, rot = (cx, cy + math.cos(a) * r, cz + math.sin(a) * r), (0, math.pi / 2, 0)
        else:
            p, rot = (cx + math.cos(a) * r, cy + math.sin(a) * r, cz), (0, 0, 0)
        o.append(eisen.cylinder(f'{name}{i}', size, 0.07 if axis != 'Z' else 0.02, p, mat, segments=6, rot=rot))


# --------------------------------------------------------------------------- Greifarm

def inserter_base(m, burner=True):
    """Achteckige Grundplatte mit Ankerschrauben, Drehkranz mit Zahnkranz und Warnring, Antrieb hinten
    (Brennkammer mit Schornstein oder Elektromotor mit Kühlrippen und Kabel)."""
    o = []
    o.append(eisen.cylinder('plate', 0.39, 0.06, (0, 0, 0.03), m.dark, segments=8, rot=(0, 0, math.pi / 8), bevel=0.012))
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        o.append(eisen.cylinder(f'anchor{i}', 0.028, 0.03, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.07), m.bright, segments=6))
    o.append(eisen.cylinder('turn', 0.3, 0.07, (0, 0, 0.095), m.paint, segments=28, bevel=0.012))
    g = bauten.gear('crown', 0.315, 0.29, 30, 0.04, m.steel)
    g.location = (0, 0, 0.1)
    o.append(g)
    # schmaler Warnring am Rand des Drehkranzes (innen wieder Anstrich)
    o.append(eisen.cylinder('hazring', 0.285, 0.016, (0, 0, 0.134), m.hazard, segments=28))
    o.append(eisen.cylinder('turntop', 0.245, 0.02, (0, 0, 0.138), m.paint, segments=28))
    o.append(eisen.cylinder('pillar', 0.13, 0.2, (0, 0, 0.24), m.steel, segments=18, bevel=0.01))
    o.append(eisen.cylinder('collar', 0.155, 0.04, (0, 0, 0.33), m.dark, segments=18, bevel=0.008))
    ring_bolts(o, m.bright, (0, 0, 0.352), 0.12, 6, 'Z', 0.012, 'cb')
    if burner:
        o.append(eisen.box('firebox', (0.28, 0.15, 0.17), (0, -0.28, 0.13), m.dark, bevel=0.012))
        o.append(eisen.box('door', (0.14, 0.02, 0.08), (0, -0.36, 0.12), m.steel, bevel=0.004))
        o.append(eisen.box('fuelglow', (0.1, 0.01, 0.025), (0, -0.372, 0.12), eisen.emission_material('ember', (1.0, 0.35, 0.08), 2.4)))
        o.append(eisen.cylinder('stack', 0.03, 0.16, (0.09, -0.3, 0.29), m.rust, segments=10))
        o.append(eisen.cylinder('stackcap', 0.042, 0.025, (0.09, -0.3, 0.38), m.dark, segments=10))
        o.append(eisen.box('patch', (0.09, 0.005, 0.07), (-0.08, -0.356, 0.15), m.rust, rot=(0, 0.2, 0)))
    else:
        o.append(eisen.cylinder('motor', 0.085, 0.22, (0, -0.28, 0.14), m.dark, segments=18, rot=(0, math.pi / 2, 0), bevel=0.01))
        for k in range(5):
            o.append(eisen.cylinder(f'fin{k}', 0.095, 0.012, (-0.08 + k * 0.04, -0.28, 0.14), m.steel, segments=18, rot=(0, math.pi / 2, 0)))
        o.append(eisen.box('jbox', (0.09, 0.07, 0.07), (0.16, -0.27, 0.15), m.paint2, bevel=0.006))
        kit.cable(o, 'cable', [(0.16, -0.23, 0.15), (0.12, -0.15, 0.2), (0.07, -0.1, 0.24)], 0.014, m.rubber, sag=0.02)
        o.append(eisen.box('lamp', (0.04, 0.015, 0.02), (-0.06, -0.37, 0.2), eisen.emission_material('elamp', (0.4, 1.0, 0.35), 2.0)))
    return eisen.parent_all(o, 'inserterBase')


def inserter_arm(m, length=1.0):
    """Arm nach Norden (+Y) vom Drehpunkt im Ursprung: Gelenkkopf, Kastenträger aus zwei Wangen mit Querstegen,
    Hydraulikzylinder obenauf, Schlauch, Handgelenk und dreifingriger Greifer am Ende."""
    o = []
    z = 0.42
    L = length - 0.06
    o.append(eisen.cylinder('pivot', 0.12, 0.12, (0, 0, 0.4), m.dark, segments=18, bevel=0.01))
    o.append(eisen.cylinder('pivotcap', 0.08, 0.03, (0, 0, 0.475), m.paint, segments=18))
    ring_bolts(o, m.bright, (0, 0, 0.492), 0.055, 5, 'Z', 0.01, 'pb')
    for sx in (-1, 1):
        o.append(eisen.box(f'cheek{sx}', (0.024, L, 0.085), (sx * 0.045, L / 2, z), m.paint, bevel=0.008))
    n = max(2, int(L / 0.2))
    for k in range(n):
        y = 0.12 + k * (L - 0.2) / max(1, n - 1)
        o.append(eisen.box(f'rib{k}', (0.11, 0.022, 0.022), (0, y, z + 0.045), m.dark))
    # Hydraulik: Zylinder + Kolbenstange
    o.append(pipe('hyd', (0, 0.08, z + 0.085), (0, L * 0.55, z + 0.085), 0.026, m.steel, 12))
    o.append(pipe('rod', (0, L * 0.55, z + 0.085), (0, L * 0.86, z + 0.075), 0.012, m.bright, 8))
    kit.cable(o, 'hose', [(0.06, 0.02, z + 0.06), (0.075, L * 0.4, z + 0.02), (0.06, L * 0.9, z + 0.02)], 0.011, m.rubber, sag=0.02)
    # Handgelenk und Greifer
    o.append(eisen.cylinder('wrist', 0.055, 0.17, (0, L + 0.01, 0.4), m.dark, segments=14, rot=(0, math.pi / 2, 0), bevel=0.008))
    o.append(eisen.box('palm', (0.13, 0.05, 0.07), (0, L + 0.06, 0.39), m.steel, bevel=0.008))
    for sx, rz in ((-1, 0.25), (1, -0.25)):
        f = eisen.box(f'claw{sx}', (0.03, 0.13, 0.05), (sx * 0.05, L + 0.14, 0.38), m.steel, bevel=0.006)
        f.rotation_euler = (0, 0, rz)
        o.append(f)
    o.append(eisen.box('thumb', (0.03, 0.1, 0.035), (0, L + 0.12, 0.35), m.dark, bevel=0.005))
    return eisen.parent_all(o, 'inserterArm')


# --------------------------------------------------------------------------- Kisten

def wooden_chest(m, seed=3):
    """Notbau-Kiste aus ungleichen Brettern mit Fugen, Eckwinkeln aus Blech, Nägeln und einem Flicken."""
    rnd = random.Random(seed)
    woods = [gw_ground.pmat(f'k_wood{i}', lin(c), 0.88, 0.35, 0.5, 30) for i, c in enumerate(('#7a5a38', '#6a4c2e', '#82623d', '#5e4529'))]
    o = []
    o.append(eisen.box('core', (0.76, 0.74, 0.5), (0, 0, 0.26), m.soot))
    # Seiten: senkrechte Bretter rundum (vorne sichtbar), Deckel: Bretter quer
    for k in range(4):
        x = -0.3 + k * 0.2
        w = 0.188 + rnd.uniform(-0.01, 0.0)
        o.append(eisen.box(f'front{k}', (w, 0.04, 0.5 + rnd.uniform(-0.01, 0.01)), (x, -0.385, 0.26), rnd.choice(woods), bevel=0.01))
        o.append(eisen.box(f'back{k}', (w, 0.04, 0.5), (x, 0.385, 0.26), rnd.choice(woods), bevel=0.01))
    for sx in (-1, 1):
        for k in range(4):
            y = -0.29 + k * 0.195
            o.append(eisen.box(f'side{sx}{k}', (0.04, 0.188, 0.5), (sx * 0.395, y, 0.26), rnd.choice(woods), bevel=0.01))
    for k in range(4):
        y = -0.3 + k * 0.2
        o.append(eisen.box(f'lid{k}', (0.84, 0.19, 0.05), (rnd.uniform(-0.01, 0.01), y, 0.535 + rnd.uniform(0, 0.008)), rnd.choice(woods), bevel=0.012))
    # Querleisten auf dem Deckel und vorne
    for sx in (-1, 1):
        o.append(eisen.box(f'batten{sx}', (0.07, 0.8, 0.03), (sx * 0.28, 0, 0.57), woods[1], bevel=0.008))
    o.append(eisen.box('frontbatten', (0.8, 0.03, 0.07), (0, -0.41, 0.42), woods[1], bevel=0.008))
    # Eckwinkel und Nägel
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'corner{sx}{sy}', (0.07, 0.07, 0.56), (sx * 0.395, sy * 0.39, 0.28), m.steel, bevel=0.006))
            o.append(eisen.box(f'cornertop{sx}{sy}', (0.12, 0.12, 0.012), (sx * 0.37, sy * 0.36, 0.565), m.steel))
    for i, x in enumerate((-0.28, 0.28)):
        for z in (0.16, 0.36):
            o.append(eisen.cylinder(f'nail{i}{z}', 0.008, 0.01, (x, -0.428, z), m.dark, segments=6, rot=(math.pi / 2, 0, 0)))
    o.append(eisen.box('patch', (0.16, 0.012, 0.12), (0.12, -0.41, 0.2), m.rust, bevel=0.004, rot=(0, 0.12, 0)))
    o.append(eisen.box('hasp', (0.06, 0.02, 0.1), (0, -0.43, 0.5), m.brass, bevel=0.005))
    return eisen.parent_all(o, 'wchest')


def iron_chest(m, seed=5):
    """Kiste aus geschweißten Eisenblechen: Flicken-Deckel, Winkelrahmen, Nietreihen, Scharniere, Riegel."""
    rnd = random.Random(seed)
    body = W('k_chest', '#4e4f4b', metal=0.75, rough=0.45, rust=0.45, dust=0.5, edge=0.6, streaks=0.55)
    body2 = W('k_chest2', '#5a5047', metal=0.7, rough=0.5, rust=0.55, dust=0.45, edge=0.55, streaks=0.5)
    o = []
    o.append(eisen.box('body', (0.8, 0.76, 0.48), (0, 0, 0.25), body, bevel=0.02))
    o.append(eisen.box('lid', (0.86, 0.82, 0.08), (0, 0, 0.53), body, bevel=0.02))
    kit.paneled_top(o, -0.4, -0.38, 0.4, 0.38, 0.57, 2, 2, [body, body2], rnd, gap=0.016, thick=0.02, jitter=0.004, bolts_mat=m.bright)
    o.append(eisen.box('seam', (0.82, 0.78, 0.014), (0, 0, 0.485), m.seam))
    # Winkelrahmen an den Kanten
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'corner{sx}{sy}', (0.07, 0.07, 0.6), (sx * 0.4, sy * 0.38, 0.3), m.dark, bevel=0.008))
    o.append(eisen.box('band', (0.84, 0.02, 0.06), (0, -0.39, 0.16), m.dark, bevel=0.004))
    bolts(o, m.bright, [(x, -0.402, 0.16) for x in (-0.3, -0.15, 0, 0.15, 0.3)], 0, 0.011, 'Y')
    # vorne: Schweißnaht, Flicken, Riegel; hinten Scharniere
    o.append(eisen.box('weld', (0.012, 0.01, 0.4), (-0.12, -0.384, 0.27), m.seam))
    o.append(eisen.box('patch', (0.18, 0.012, 0.14), (0.2, -0.386, 0.33), body2, bevel=0.004, rot=(0, -0.08, 0)))
    for sx in (-0.24, 0.24):
        o.append(eisen.cylinder(f'hinge{sx}', 0.025, 0.12, (sx, 0.415, 0.5), m.dark, segments=10, rot=(0, math.pi / 2, 0)))
    o.append(eisen.box('latch', (0.1, 0.025, 0.1), (0, -0.405, 0.48), m.brass, bevel=0.006))
    o.append(eisen.box('handle', (0.22, 0.03, 0.03), (0, -0.42, 0.36), m.bright, bevel=0.008))
    return eisen.parent_all(o, 'chest')


def steel_chest(m):
    """Werkstatt-Kiste: schwerer Stahlkasten mit senkrechten Sicken, Eckschutz, Warnstreifen an der Deckelkante."""
    body = W('k_schest', '#6a7075', metal=0.85, rough=0.38, rust=0.18, dust=0.38, edge=0.5, streaks=0.3)
    o = []
    o.append(eisen.box('body', (0.82, 0.78, 0.5), (0, 0, 0.26), body, bevel=0.025))
    o.append(eisen.box('lid', (0.88, 0.84, 0.09), (0, 0, 0.555), body, bevel=0.025))
    o.append(eisen.box('lidseam', (0.84, 0.8, 0.012), (0, 0, 0.508), m.seam))
    for k in range(5):
        x = -0.28 + k * 0.14
        o.append(eisen.box(f'sick{k}', (0.035, 0.02, 0.36), (x, -0.395, 0.25), body, bevel=0.008))
    o.append(eisen.box('haz', (0.86, 0.012, 0.035), (0, -0.426, 0.555), m.hazard))
    for k in range(3):
        o.append(eisen.box(f'rib{k}', (0.88, 0.035, 0.025), (0, -0.25 + k * 0.25, 0.61), m.dark, bevel=0.004))
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'guard{sx}{sy}', (0.1, 0.1, 0.62), (sx * 0.4, sy * 0.38, 0.31), m.dark, bevel=0.012))
            o.append(eisen.cylinder(f'gb{sx}{sy}', 0.012, 0.012, (sx * 0.4, sy * 0.38 - 0.052 * (sy < 0), 0.5), m.bright, segments=6, rot=(math.pi / 2, 0, 0)))
    o.append(eisen.box('plate', (0.16, 0.012, 0.08), (-0.2, -0.41, 0.42), m.bright, bevel=0.004))
    o.append(eisen.box('handle', (0.2, 0.035, 0.04), (0.18, -0.43, 0.42), m.dark, bevel=0.008))
    return eisen.parent_all(o, 'schest')


# --------------------------------------------------------------------------- Rohr

def flange(o, name, loc, axis, m):
    rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0)}[axis]
    o.append(eisen.cylinder(name, PIPE_R * 1.38, 0.05, loc, m.dark, segments=18, rot=rot, bevel=0.008))
    ring_bolts(o, m.bright, loc, PIPE_R * 1.15, 6, axis, 0.012, name + 'b')


def pipe_piece(m, mask):
    """Rohrstück (N=1, O=2, S=4, W=8): Flansche mit Schraubenkranz an den Feldgrenzen, Schweißringe,
    Gussknoten an Abzweigen, Rohrschelle auf einem Stützbock."""
    pm = W('k_pipe', '#5a5c58', metal=0.8, rough=0.42, rust=0.45, dust=0.45, edge=0.55, streaks=0.45)
    o = []
    dirs = [k for k in range(4) if mask & (1 << k)]
    z = PIPE_Z
    straight = len(dirs) == 2 and (dirs[0] + 2) % 4 == dirs[1]
    if not dirs:
        o.append(pipe('p', (0, -0.32, z), (0, 0.32, z), PIPE_R, pm, 20))
        for s in (-1, 1):
            o.append(eisen.cylinder(f'cap{s}', PIPE_R * 1.15, 0.06, (0, s * 0.33, z), m.dark, segments=20, rot=(math.pi / 2, 0, 0), bevel=0.01))
    else:
        for k in dirs:
            dx, dy = DIRV[k]
            axis = 'Y' if dy else 'X'
            o.append(pipe(f'arm{k}', (0, 0, z), (dx * 0.53, dy * 0.53, z), PIPE_R, pm, 20))
            flange(o, f'fl{k}', (dx * 0.47, dy * 0.47, z), axis, m)
            rot = (math.pi / 2, 0, 0) if dy else (0, math.pi / 2, 0)
            o.append(eisen.cylinder(f'weld{k}', PIPE_R * 1.04, 0.018, (dx * 0.24, dy * 0.24, z), m.seam, segments=20, rot=rot))
        if len(dirs) == 1:
            dx, dy = DIRV[dirs[0]]
            o.append(eisen.cylinder('end', PIPE_R * 1.16, 0.07, (-dx * 0.04, -dy * 0.04, z), m.dark, segments=20,
                                    rot=(math.pi / 2, 0, 0) if dy else (0, math.pi / 2, 0), bevel=0.01))
        if not straight:
            o.append(eisen.cylinder('joint', PIPE_R * 1.25, PIPE_R * 2.3, (0, 0, z), pm, segments=24, bevel=PIPE_R * 0.75))
            o.append(eisen.cylinder('seam', PIPE_R * 1.27, 0.02, (0, 0, z), m.seam, segments=24))
            ring_bolts(o, m.bright, (0, 0, z + PIPE_R * 1.1), PIPE_R * 0.75, 4, 'Z', 0.013, 'jb')
    # Stützbock mit Rohrschelle (quer zur Hauptrichtung)
    along_x = bool(dirs) and all(DIRV[k][1] == 0 for k in dirs)
    o.append(eisen.box('foot', (0.08, 0.08, z - PIPE_R), (0, 0, (z - PIPE_R) / 2), m.dark, bevel=0.008))
    o.append(eisen.box('footplate', (0.3, 0.2, 0.02) if not along_x else (0.2, 0.3, 0.02), (0, 0, 0.01), m.steel, bevel=0.004))
    if straight or not dirs or len(dirs) == 1:
        o.append(eisen.cylinder('clamp', PIPE_R * 1.1, 0.04, (0, 0, z), m.steel, segments=20,
                                rot=(0, math.pi / 2, 0) if along_x else (math.pi / 2, 0, 0)))
    return eisen.parent_all(o, 'pipe')


# --------------------------------------------------------------------------- Strommasten

def insulator(o, name, x, y, z, m, n=3, r=0.045):
    for k in range(n):
        o.append(eisen.cylinder(f'{name}{k}', r - k * 0.006, 0.032, (x, y, z + k * 0.038), m.insul, segments=12, bevel=0.006))


def small_pole(m):
    """Notbau-Mast: Holzpfahl in einem Steinsockel, Querholz mit Blechwinkeln, Porzellanisolatoren,
    Warnschild und Abspannung."""
    wood = gw_ground.pmat('k_pole', lin('#5d4a33'), 0.9, 0.4, 0.55, 26)
    o = []
    rnd = random.Random(11)
    stone = gw_ground.pmat('k_stone', lin('#6b645a'), 0.92, 0.35, 0.8, 9)
    for i in range(6):
        a = i / 6 * math.tau + rnd.uniform(-0.3, 0.3)
        o.append(eisen.rock(f'stone{i}', rnd.uniform(0.05, 0.075), (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.03), stone, 40 + i, squash=0.55))
    o.append(eisen.cylinder('pole', 0.055, POLE_TOP + 0.05, (0, 0, (POLE_TOP + 0.05) / 2), wood, segments=12))
    o.append(eisen.cylinder('band', 0.059, 0.04, (0, 0, 0.5), m.steel, segments=12))
    o.append(eisen.box('cross', (0.66, 0.07, 0.07), (0, 0, POLE_TOP - 0.12), wood, bevel=0.012))
    for s in (-1, 1):
        o.append(beam(f'strut{s}', (0, 0.0, POLE_TOP - 0.42), (s * 0.22, 0, POLE_TOP - 0.15), (0.025, 0.02), m.steel))
        o.append(eisen.box(f'bracket{s}', (0.08, 0.08, 0.02), (s * 0.26, 0, POLE_TOP - 0.075), m.steel))
        insulator(o, f'ins{s}', s * 0.26, 0, POLE_TOP - 0.06, m)
    o.append(eisen.box('sign', (0.14, 0.012, 0.12), (0, -0.062, 0.85), m.hazard, bevel=0.004))
    o.append(eisen.cylinder('cap', 0.065, 0.04, (0, 0, POLE_TOP + 0.07), m.dark, segments=12))
    return eisen.parent_all(o, 'pole')


def medium_pole(m):
    """Werkstatt-Mast: Stahl-Gittermast (Winkelprofile mit Diagonalen) auf Betonsockel, zwei Traversen."""
    o = []
    o.append(eisen.box('foot', (0.38, 0.38, 0.12), (0, 0, 0.06), m.concrete, bevel=0.025))
    bolts(o, m.bright, [(sx * 0.14, sy * 0.14) for sx in (-1, 1) for sy in (-1, 1)], 0.125, 0.016)
    a = 0.075
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'leg{sx}{sy}', (0.025, 0.025, MEDIUM_TOP), (sx * a, sy * a, MEDIUM_TOP / 2 + 0.1), m.steel))
    n = 7
    for k in range(n):
        z0 = 0.15 + k * (MEDIUM_TOP - 0.3) / n
        z1 = z0 + (MEDIUM_TOP - 0.3) / n
        s = 1 if k % 2 else -1
        for sy in (-1, 1):
            o.append(beam(f'dx{k}{sy}', (-a * s, sy * a, z0), (a * s, sy * a, z1), (0.012, 0.012), m.dark))
            o.append(beam(f'dy{k}{sy}', (sy * a, -a * s, z0), (sy * a, a * s, z1), (0.012, 0.012), m.dark))
    for z, w in ((MEDIUM_TOP - 0.1, 0.74), (MEDIUM_TOP - 0.45, 0.54)):
        o.append(eisen.box(f'cross{z}', (w, 0.07, 0.05), (0, 0, z), m.paint, bevel=0.008))
        for s in (-1, 1):
            o.append(beam(f'tie{z}{s}', (s * a, 0, z - 0.22), (s * (w / 2 - 0.06), 0, z - 0.02), (0.015, 0.015), m.dark))
            insulator(o, f'ins{z}{s}', s * (w / 2 - 0.04), 0, z + 0.05, m, r=0.04)
    o.append(eisen.box('sign', (0.13, 0.01, 0.11), (0, -a - 0.02, 0.9), m.hazard, bevel=0.003))
    o.append(eisen.box('topcap', (0.2, 0.2, 0.04), (0, 0, MEDIUM_TOP + 0.12), m.dark, bevel=0.01))
    return eisen.parent_all(o, 'mpole')


def big_pole(m):
    """Großer Mast 2×2: Fachwerkturm mit K-Verbänden, zwei Querträgern, hängenden Isolatorketten,
    Betonfundamente mit Ankerschrauben und Warnschild."""
    o = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'foot{sx}{sy}', (0.28, 0.28, 0.14), (sx * 0.6, sy * 0.6, 0.07), m.concrete, bevel=0.025))
            bolts(o, m.bright, [(sx * 0.6 + dx, sy * 0.6 + dy) for dx in (-0.08, 0.08) for dy in (-0.08, 0.08)], 0.145, 0.014)
            o.append(beam(f'leg{sx}{sy}', (sx * 0.6, sy * 0.6, 0.12), (sx * 0.15, sy * 0.15, BIG_TOP), (0.06, 0.06), m.steel))
    levels = 7
    for k in range(levels):
        z0 = 0.35 + k * 0.45
        z1 = z0 + 0.45
        r0 = 0.6 - (z0 / BIG_TOP) * 0.45
        r1 = 0.6 - (z1 / BIG_TOP) * 0.45
        for sy in (-1, 1):
            # Querriegel und K-Diagonalen auf allen vier Seiten
            o.append(beam(f'hx{k}{sy}', (-r0, sy * r0, z0), (r0, sy * r0, z0), (0.03, 0.03), m.dark))
            o.append(beam(f'hy{k}{sy}', (sy * r0, -r0, z0), (sy * r0, r0, z0), (0.03, 0.03), m.dark))
            for s in (-1, 1):
                o.append(beam(f'kx{k}{sy}{s}', (s * r0, sy * r0, z0), (0, sy * r1, z1), (0.022, 0.022), m.dark))
                o.append(beam(f'ky{k}{sy}{s}', (sy * r0, s * r0, z0), (sy * r1, 0, z1), (0.022, 0.022), m.dark))
    for z, w in ((BIG_TOP - 0.05, 1.4), (BIG_TOP - 0.55, 1.0)):
        o.append(eisen.box(f'head{z}', (w, 0.14, 0.1), (0, 0, z), m.paint, bevel=0.01))
        for s in ((-1, 0, 1) if w > 1.2 else (-1, 1)):
            x = s * (w / 2 - 0.08)
            for k in range(4):
                o.append(eisen.cylinder(f'ins{z}{s}{k}', 0.045, 0.03, (x, 0, z - 0.1 - k * 0.045), m.insul, segments=10, bevel=0.005))
    o.append(eisen.box('sign', (0.22, 0.012, 0.18), (0, -0.47, 0.75), m.hazard, bevel=0.004))
    o.append(eisen.box('signplate', (0.24, 0.008, 0.2), (0, -0.462, 0.75), m.dark))
    return eisen.parent_all(o, 'bpole')


# --------------------------------------------------------------------------- Untergrundband und Splitter

def underground(m, output=False):
    """Haube über einer Feldhälfte: Wangen in der Bandfarbe mit Warnstreifen, gewelltes Schrägdach mit
    Rippen und Schrauben, dunkler Schacht mit Gummilappen. Eingang: Haube im Norden, Ausgang: im Süden."""
    o = []
    s = -1 if output else 1
    y0, y1 = 0.0, s * 0.56
    yc, depth = (y0 + y1) / 2, abs(y1 - y0)
    for sx in (-1, 1):
        o.append(eisen.box(f'cheek{sx}', (0.1, depth, 0.42), (sx * 0.45, yc, 0.21), m.paint, bevel=0.015))
        o.append(eisen.box(f'cheekhaz{sx}', (0.104, 0.06, 0.38), (sx * 0.45, y0 + s * 0.035, 0.2), m.hazard))
        bolts(o, m.bright, [(sx * 0.502, yc + d, z) for d in (-0.12, 0.12) for z in (0.1, 0.3)], 0, 0.013, 'X')
    roof = eisen.box('roof', (1.0, depth + 0.08, 0.07), (0, yc + s * 0.02, 0.4), m.paint, bevel=0.02)
    roof.rotation_euler = (s * math.radians(14), 0, 0)
    o.append(roof)
    o.append(eisen.box('back', (1.0, 0.08, 0.4), (0, y1 - s * 0.02, 0.2), m.dark, bevel=0.01))
    o.append(eisen.box('mouth', (0.8, 0.04, 0.3), (0, y0 + s * 0.04, 0.16), m.soot))
    for k in range(6):
        o.append(eisen.box(f'flap{k}', (0.12, 0.012, 0.16), (-0.31 + k * 0.124, y0 - s * 0.005, 0.22), m.rubber, bevel=0.003))
    o.append(eisen.box('lip', (0.98, 0.07, 0.07), (0, y0 + s * 0.03, 0.35), m.dark, bevel=0.01))
    for k in (-0.3, 0.0, 0.3):
        rib = eisen.box(f'rib{k}', (0.035, depth * 0.92, 0.03), (k, yc + s * 0.02, 0.445), m.dark)
        rib.rotation_euler = (s * math.radians(14), 0, 0)
        o.append(rib)
    # Querfuge und Schrauben auf dem Dach
    seam = eisen.box('roofseam', (0.96, 0.012, 0.01), (0, yc + s * 0.02, 0.437), m.seam)
    seam.rotation_euler = (s * math.radians(14), 0, 0)
    o.append(seam)
    return eisen.parent_all(o, 'ug')


def splitter(m, phase=0.0):
    """Brücke quer über beide Bänder: Pfeiler mit Warnstreifen, Doppel-T-Träger, Getriebekasten mit Zahnrad,
    Motor und Kabel, Verteilerzunge und Leitbleche."""
    o = []
    for x in (-0.98, 0.98):
        o.append(eisen.box(f'pier{x}', (0.13, 0.72, 0.5), (x, 0, 0.25), m.paint, bevel=0.02))
        o.append(eisen.box(f'pierhaz{x}', (0.134, 0.04, 0.44), (x, -0.36, 0.24), m.hazard))
        bolts(o, m.bright, [(x, y) for y in (-0.25, 0.25)], 0.505, 0.016)
    o.append(eisen.box('mid', (0.14, 0.9, 0.36), (0, -0.02, 0.18), m.paint2, bevel=0.02))
    kit.ibeam(o, 'bridge', (-1.04, -0.05, 0.56), (1.04, -0.05, 0.56), 0.13, 0.2, m.paint)
    o.append(eisen.box('gearbox', (0.52, 0.44, 0.28), (0, -0.05, 0.76), m.dark, bevel=0.03))
    bolts(o, m.bright, [(x, y) for x in (-0.22, 0.22) for y in (-0.24, 0.14)], 0.905, 0.014)
    g = bauten.gear('sg', 0.2, 0.16, 12, 0.05, m.brass)
    g.location = (0, -0.05, 0.92)
    g.rotation_euler = (0, 0, phase * math.tau / 6)
    o.append(g)
    o.append(eisen.cylinder('motor', 0.08, 0.22, (0.42, -0.05, 0.74), m.steel, segments=16, rot=(0, math.pi / 2, 0), bevel=0.01))
    kit.cable(o, 'cable', [(0.53, -0.05, 0.74), (0.7, -0.05, 0.66), (0.98, 0.1, 0.52)], 0.016, m.rubber, sag=0.03)
    o.append(eisen.box('tongue', (0.06, 0.5, 0.18), (0, 0.42, 0.17), m.bright, bevel=0.01))
    for x in (-0.5, 0.5):
        o.append(eisen.box(f'guide{x}', (0.86, 0.04, 0.05), (x, -0.3, 0.32), m.dark))
    return eisen.parent_all(o, 'splitter')
