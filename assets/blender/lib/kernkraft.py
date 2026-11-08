"""Kernkraft im Stil „Hochtechnik“ (Stufe 3, docs/ART_STYLE.md): Kernreaktor, Wärmerohr, Wärmetauscher,
Dampfturbine, Zentrifuge. Glatte Verbundpaneele, feine Fugen, Leuchtstreifen, kaum Verschleiß; die Wärmeteile
in Kupfer, damit man die Wärmewege erkennt. Maße in Feldern, Richtung Nord, Ursprung in der Mitte."""
import math

import bauten
import eisen
import kit
from anlagen import PIPE_R, PIPE_Z, flange
from bauten import beam, bolts, pipe

W = bauten.weathered


class Mats:
    def __init__(self, glow_level=0.0):
        self.t = kit.Tier(3, accent='#3f7f5a', prefix='nk_')
        self.copper = W('nk_cu', '#a8643a', metal=0.9, rough=0.32, rust=0.15, dust=0.2, edge=0.5, rust_hex='#4f7a62')
        self.conc = W('nk_conc', '#7d7b75', metal=0.05, rough=0.9, rust=0.0, dust=0.3, edge=0.2, grime=0.3, streaks=0.2)
        self.dark = W('nk_dark', '#1e2022', metal=0.5, rough=0.45, rust=0.0, dust=0.15, edge=0.3, grime=0.2, streaks=0.0)
        self.bright = W('nk_bright', '#9aa0a2', metal=0.9, rough=0.25, rust=0.0, dust=0.1, edge=0.3, grime=0.1, streaks=0.0)
        self.hazard = kit.hazard('nk_haz', wear=0.2, scale=10.0)
        g = max(0.0, glow_level)
        self.core = eisen.emission_material('nk_core', (0.35, 1.0, 0.45), 6.0 * g) if g > 0 else eisen.material('nk_core0', eisen.srgb('#203a28'), rough=0.2, metal=0.3)
        self.hot = eisen.emission_material('nk_hot', (1.0, 0.42, 0.12), 5.0 * g) if g > 0 else self.copper
        self.strip = kit.glow('nk_strip', '#7dffb0', 2.5)


# --------------------------------------------------------------------------- Kernreaktor 5×5

def reactor(m, glow=0.0):
    """Betonsockel mit Kupfer-Wärmeanschlüssen an allen Seiten, Druckbehälter mit Kuppel und Kernfenstern,
    vier Kühlblöcke, Leuchtstreifen und Warnkante."""
    mm = Mats(glow)
    t = mm.t
    o = []
    o.append(eisen.box('base', (4.9, 4.9, 0.3), (0, 0, 0.15), mm.conc, bevel=0.06))
    o[-1]['kit_box'] = (4.9, 4.9, 0.3)
    o.append(eisen.box('hazedge', (4.92, 4.92, 0.05), (0, 0, 0.29), mm.hazard))
    # Wärmeanschlüsse: drei Kupferpads je Seite
    for k in (-1.5, 0, 1.5):
        for (x, y, rx, ry) in ((k, 2.38, 0.36, 0.2), (k, -2.38, 0.36, 0.2), (2.38, k, 0.2, 0.36), (-2.38, k, 0.2, 0.36)):
            o.append(eisen.box(f'pad{x}{y}', (rx, ry, 0.18), (x, y, 0.36), mm.copper, bevel=0.02))
    # Kühlblöcke in den Ecken
    for sx in (-1, 1):
        for sy in (-1, 1):
            b = eisen.box(f'block{sx}{sy}', (1.2, 1.2, 0.9), (sx * 1.6, sy * 1.6, 0.75), t.panels[sx * sy > 0 and 1 or 0], bevel=0.04)
            b['kit_box'] = (1.2, 1.2, 0.9)
            o.append(b)
            kit.grille(o, f'gr{sx}{sy}', 0.8, 0.8, (sx * 1.6, sy * 1.6, 1.22), t.frame, t.metal, slats=6)
            o.append(eisen.box(f'strip{sx}{sy}', (0.9, 0.03, 0.03), (sx * 1.6, sy * 1.6 - 0.62, 0.9), mm.strip))
    # Druckbehälter mit Kuppel
    o.append(eisen.cylinder('vessel', 1.25, 1.3, (0, 0, 0.95), t.panels[0], segments=40, bevel=0.06))
    o.append(eisen.cylinder('ring1', 1.28, 0.08, (0, 0, 0.7), t.frame, segments=40))
    o.append(eisen.cylinder('ring2', 1.28, 0.08, (0, 0, 1.35), t.frame, segments=40))
    dome = eisen.cylinder('dome', 1.15, 0.5, (0, 0, 1.75), t.panels[1], segments=40, bevel=0.45)
    o.append(dome)
    o.append(eisen.cylinder('cap', 0.35, 0.18, (0, 0, 2.08), t.metal, segments=24, bevel=0.04))
    # Kernfenster (leuchten grün im Betrieb)
    for k in range(6):
        a = k / 6 * math.tau + math.pi / 6
        win = eisen.box(f'win{k}', (0.32, 0.04, 0.42), (math.cos(a) * 1.255, math.sin(a) * 1.255, 1.0), mm.core)
        win.rotation_euler = (0, 0, a + math.pi / 2)
        o.append(win)
    bolts(o, mm.bright, [(math.cos(k / 12 * math.tau) * 1.2, math.sin(k / 12 * math.tau) * 1.2) for k in range(12)], 1.4, 0.02)
    kit.ladder(o, 'ladder', 0.0, -1.27, 0.3, 1.6, t.metal, facing='Y')
    return eisen.parent_all(o, 'reactor')


# --------------------------------------------------------------------------- Wärmerohr

DIRV = [(0, 1), (1, 0), (0, -1), (-1, 0)]


def heat_pipe(mask, glow=0.0):
    """Kupferrohr mit Kühlrippen; ohne Anschluss ein kurzes Stück. glow > 0: nur die Rohre leuchten."""
    mm = Mats(glow)
    body = mm.hot if glow > 0 else mm.copper
    dark = eisen.material('hp_black', (0, 0, 0), rough=1.0) if glow > 0 else mm.dark
    o = []
    z = 0.16
    r = 0.09
    dirs = [k for k in range(4) if mask & (1 << k)]
    o.append(eisen.box('core', (0.26, 0.26, 0.2), (0, 0, z), body, bevel=0.03))
    for k in dirs or [0, 2]:
        dx, dy = DIRV[k]
        o.append(pipe(f'arm{k}', (0, 0, z), (dx * 0.52, dy * 0.52, z), r, body, 12))
        for f in (0.22, 0.36):
            rot = (math.pi / 2, 0, 0) if dy else (0, math.pi / 2, 0)
            o.append(eisen.cylinder(f'fin{k}{f}', r * 1.6, 0.025, (dx * f, dy * f, z), body, segments=12, rot=rot))
    o.append(eisen.box('foot', (0.3, 0.3, 0.06), (0, 0, 0.03), dark, bevel=0.01))
    return eisen.parent_all(o, 'heatpipe')


# --------------------------------------------------------------------------- Wärmetauscher 3×2

def heat_exchanger(m, glow=0.0):
    """Liegender Kessel (wie Kessel 3×2): Wärmeeingang hinten (Kupferblock unten Mitte), Dampf oben Mitte,
    Wasser an den Schmalseiten, glatte Verkleidung mit Leuchtstreifen."""
    mm = Mats(glow)
    t = mm.t
    o = []
    o.append(eisen.box('skid', (2.9, 1.9, 0.12), (0, 0, 0.06), t.frame, bevel=0.02))
    tank = eisen.cylinder('tank', 0.62, 2.5, (0, 0.05, 0.75), t.panels[0], segments=32, rot=(0, math.pi / 2, 0), bevel=0.12)
    o.append(tank)
    for x in (-0.9, 0, 0.9):
        o.append(eisen.cylinder(f'band{x}', 0.64, 0.08, (x, 0.05, 0.75), t.frame, segments=32, rot=(0, math.pi / 2, 0)))
    o.append(eisen.box('heatblock', (0.7, 0.45, 0.55), (0, -0.72, 0.4), mm.hot if glow > 0 else mm.copper, bevel=0.04))
    o.append(eisen.box('hb_frame', (0.8, 0.5, 0.1), (0, -0.72, 0.72), t.frame, bevel=0.02))
    # Dampfstutzen oben Mitte (nach Norden), Wasser an den Seiten
    o.append(pipe('steam', (0, 0.3, 1.0), (0, 1.02, PIPE_Z + 0.3), PIPE_R, t.metal, 16))
    flange(o, 'fls', (0, 0.94, PIPE_Z + 0.3), 'Y', bauten.Mats())
    for sx in (-1, 1):
        o.append(pipe(f'water{sx}', (sx * 1.2, -0.45, PIPE_Z), (sx * 1.52, -0.45, PIPE_Z), PIPE_R, t.metal, 16))
        flange(o, f'flw{sx}', (sx * 1.44, -0.45, PIPE_Z), 'X', bauten.Mats())
    o.append(eisen.box('strip', (2.2, 0.03, 0.03), (0, -0.58, 1.2), mm.strip))
    o.append(eisen.box('haz', (2.92, 0.02, 0.06), (0, -0.96, 0.1), mm.hazard))
    return eisen.parent_all(o, 'hx')


# --------------------------------------------------------------------------- Dampfturbine 3×5

def steam_turbine(m, phase=0.0):
    """Lange Turbine: gerippte Gehäusehälften auf Sockel, Generator mit Kühlrippen, sichtbare Kupplung
    (dreht mit phase), Dampfanschlüsse an beiden Enden."""
    mm = Mats()
    t = mm.t
    o = []
    o.append(eisen.box('skid', (2.6, 4.8, 0.2), (0, 0, 0.1), t.frame, bevel=0.03))
    o[-1]['kit_box'] = (2.6, 4.8, 0.2)
    casing = eisen.cylinder('casing', 0.85, 2.6, (0, 0.8, 0.95), t.panels[0], segments=36, rot=(math.pi / 2, 0, 0), bevel=0.15)
    o.append(casing)
    for k in range(7):
        y = -0.4 + k * 0.4
        o.append(eisen.cylinder(f'rib{k}', 0.88, 0.06, (0, y, 0.95), t.frame, segments=36, rot=(math.pi / 2, 0, 0)))
    gen = eisen.box('gen', (1.6, 1.4, 1.3), (0, -1.55, 0.85), t.panels[1], bevel=0.08)
    gen['kit_box'] = (1.6, 1.4, 1.3)
    o.append(gen)
    for k in range(6):
        o.append(eisen.box(f'cool{k}', (1.64, 0.05, 0.9), (0, -2.1 + k * 0.2, 0.85), t.frame))
    # Kupplung zwischen Turbine und Generator
    sh = eisen.cylinder('shaft', 0.22, 0.4, (0, -0.65, 0.95), t.metal, segments=16, rot=(math.pi / 2, 0, 0))
    o.append(sh)
    for k in range(4):
        a = phase * math.tau + k * math.pi / 2
        o.append(eisen.box(f'cpl{k}', (0.06, 0.35, 0.06), (math.cos(a) * 0.24, -0.65, 0.95 + math.sin(a) * 0.24), mm.bright))
    for s, y in ((1, 2.45), (-1, -2.45)):
        o.append(pipe(f'port{s}', (0, s * 2.0, PIPE_Z + 0.25), (0, y, PIPE_Z + 0.25), PIPE_R, t.metal, 16))
        flange(o, f'fl{s}', (0, y - s * 0.06, PIPE_Z + 0.25), 'Y', bauten.Mats())
    o.append(eisen.box('strip', (0.03, 2.4, 0.03), (0.87, 0.8, 0.95), mm.strip))
    o.append(eisen.box('strip2', (0.03, 2.4, 0.03), (-0.87, 0.8, 0.95), mm.strip))
    kit.railing(o, [(-1.25, -2.35, 0.2), (1.25, -2.35, 0.2)], 0.35, t.metal)
    return eisen.parent_all(o, 'turbine')


# --------------------------------------------------------------------------- Zentrifuge 3×3

def centrifuge(m, phase=0.0, glow=0.0):
    """Drei Trommeln auf einem Sockel, Deckel drehen mit phase, grüne Leuchtringe, Versorgungsleitungen."""
    mm = Mats(glow)
    t = mm.t
    o = []
    o.append(eisen.box('base', (2.85, 2.85, 0.25), (0, 0, 0.125), t.frame, bevel=0.04))
    o[-1]['kit_box'] = (2.85, 2.85, 0.25)
    o.append(eisen.box('deck', (2.6, 2.6, 0.12), (0, 0, 0.31), t.panels[1], bevel=0.03))
    for k in range(3):
        a = k / 3 * math.tau + math.pi / 2
        x, y = math.cos(a) * 0.72, math.sin(a) * 0.72
        o.append(eisen.cylinder(f'drum{k}', 0.42, 1.0, (x, y, 0.87), t.panels[0], segments=28, bevel=0.06))
        o.append(eisen.cylinder(f'ring{k}', 0.44, 0.06, (x, y, 0.75), mm.core if glow > 0 else mm.strip, segments=28))
        lid = eisen.cylinder(f'lid{k}', 0.36, 0.12, (x, y, 1.42), t.metal, segments=28, bevel=0.04)
        o.append(lid)
        for j in range(3):
            b = phase * math.tau * 2 + j * math.tau / 3 + k
            o.append(eisen.box(f'vane{k}{j}', (0.3, 0.05, 0.04), (x + math.cos(b) * 0.15, y + math.sin(b) * 0.15, 1.5), t.frame, rot=(0, 0, b)))
    o.append(eisen.cylinder('hub', 0.25, 0.7, (0, 0, 0.72), t.frame, segments=20))
    kit.cable(o, 'c1', [(0.5, -1.2, 0.4), (0.3, -0.6, 0.6), (0.0, -0.2, 0.9)], 0.04, t.rubber)
    o.append(eisen.box('haz', (2.87, 0.02, 0.08), (0, -1.43, 0.14), mm.hazard))
    return eisen.parent_all(o, 'centrifuge')
