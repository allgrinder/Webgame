"""Eisenbahn und Schaltungsnetz (Bibliothek): Gleise (gerade 2×2, Bogen 4×4 mit Radius 3), Lokomotive, Güterwagen,
Bahnhof und Kombinatoren. Blender: x nach Osten, y nach Norden; Spielfelder y nach Süden."""
import math

import anlagen
import eisen
import gw_ground
from bauten import beam, bolts

lin = gw_ground.lin
RAIL_GAUGE = 0.36


def _mats():
    ballast = gw_ground.pmat('b_ballast', lin('#6f675c'), 0.95, 0.4, 0.6, 40)
    sleeper = eisen.material('b_sleeper', eisen.srgb('#4a3a2c'), rough=0.9, noise=0.3, noise_scale=12)
    rail = eisen.material('b_rail', eisen.srgb('#8a8a86'), rough=0.3, metal=0.9)
    return ballast, sleeper, rail


def _track(points, tangents, ballast, sleeper, rail, o):
    """Gleis entlang einer Folge von Punkten (Blender-Koordinaten) mit Tangenten."""
    n = len(points)
    for i in range(n - 1):
        (x0, y0), (x1, y1) = points[i], points[i + 1]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        seg = math.hypot(x1 - x0, y1 - y0)
        ang = math.atan2(y1 - y0, x1 - x0)
        o.append(eisen.box(f'bal{i}', (seg + 0.02, 1.5, 0.06), (mx, my, 0.03), ballast, rot=(0, 0, ang)))
        for side in (-1, 1):
            nx, ny = -math.sin(ang) * RAIL_GAUGE * side, math.cos(ang) * RAIL_GAUGE * side
            o.append(eisen.box(f'r{i}{side}', (seg + 0.01, 0.07, 0.08), (mx + nx, my + ny, 0.16), rail, rot=(0, 0, ang)))
    # Schwellen alle 0,5 Felder
    total = sum(math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]) for i in range(n - 1))
    k = 0
    d = 0.25
    acc = 0.0
    for i in range(n - 1):
        (x0, y0), (x1, y1) = points[i], points[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        while d <= acc + seg and d < total:
            t = (d - acc) / seg
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            ang = math.atan2(y1 - y0, x1 - x0)
            o.append(eisen.box(f'sl{k}', (0.16, 1.1, 0.06), (x, y, 0.09), sleeper, rot=(0, 0, ang)))
            k += 1
            d += 0.5
        acc += seg
    tangents  # noqa: B018


def straight_rail(m):
    ballast, sleeper, rail = _mats()
    o = []
    _track([(0, -1.0), (0, 1.0)], None, ballast, sleeper, rail, o)
    return eisen.parent_all(o, 'srail')


def curved_rail(m):
    """Bogen dir 0 im 4×4-Block: Spiel (1,4)→(4,1) um (4,4) mit Radius 3; Blender relativ zur Blockmitte."""
    ballast, sleeper, rail = _mats()
    pts = []
    for i in range(25):
        a = math.pi + (i / 24) * math.pi / 2
        gx, gy = 4 + 3 * math.cos(a), 4 + 3 * math.sin(a)
        pts.append((gx - 2, -(gy - 2)))
    o = []
    _track(pts, None, ballast, sleeper, rail, o)
    return eisen.parent_all(o, 'crail')


def diagonal_rail(m):
    """Diagonalstück dir 0 im 2×2-Block: Spiel (0,1)→(1,0) (schneidet die linke obere Ecke)."""
    ballast, sleeper, rail = _mats()
    o = []
    _track([(-1.0, 0.0), (0.0, 1.0)], None, ballast, sleeper, rail, o)
    return eisen.parent_all(o, 'drail')


def half_rail(m, mirror=False):
    """45°-Übergang dir 0 im 2×4-Block: Spiel (1,4) nach Norden, Vorlauf 2−√2, Bogen r = 2+√2 bis (2,1) bzw. (0,1)."""
    ballast, sleeper, rail = _mats()
    r = 2 + math.sqrt(2)
    lead = 2 - math.sqrt(2)
    s = -1 if mirror else 1
    pts = [(1, 4)]
    for i in range(25):
        a = (i / 24) * math.pi / 4
        pts.append((1 + s * (r - r * math.cos(a)), 4 - lead - r * math.sin(a)))
    o = []
    _track([(gx - 1, -(gy - 2)) for gx, gy in pts], None, ballast, sleeper, rail, o)
    return eisen.parent_all(o, 'hrail')


def locomotive(m):
    """Lokomotive 2×6, Fahrtrichtung Norden (+y)."""
    body = anlagen.paint('#8a2f24', 'b_loco')
    trim = anlagen.paint('#c9a23a', 'b_trim')
    o = []
    for y in (-2.0, 2.0):
        o.append(eisen.box(f'bogie{y}', (1.2, 1.4, 0.3), (0, y, 0.3), m.dark, bevel=0.05))
        for x in (-0.45, 0.45):
            for dy in (-0.4, 0.4):
                o.append(eisen.cylinder(f'wh{y}{x}{dy}', 0.22, 0.12, (x, y + dy, 0.24), m.steel, segments=16, rot=(0, math.pi / 2, 0)))
    o.append(eisen.box('frame', (1.5, 5.8, 0.2), (0, 0, 0.55), m.dark, bevel=0.04))
    o.append(eisen.box('hood', (1.25, 4.0, 0.9), (0, -0.7, 1.1), body, bevel=0.12))
    o.append(eisen.box('cab', (1.45, 1.5, 1.3), (0, 2.0, 1.3), body, bevel=0.1))
    o.append(eisen.box('cabroof', (1.55, 1.6, 0.1), (0, 2.0, 1.98), m.dark, bevel=0.03))
    o.append(eisen.box('stripe', (1.27, 4.0, 0.12), (0, -0.7, 0.85), trim))
    for y in (-2.2, -1.2, -0.2):
        o.append(eisen.box(f'vent{y}', (0.9, 0.5, 0.06), (0, y, 1.58), m.steel, bevel=0.02))
    glass = m.glass
    o.append(eisen.box('win', (1.47, 0.9, 0.35), (0, 2.1, 1.55), glass))
    lamp = eisen.emission_material('b_head', (1.0, 0.9, 0.6), 3.0)
    o.append(eisen.cylinder('head', 0.12, 0.06, (0, 2.79, 1.2), lamp, segments=12, rot=(math.pi / 2, 0, 0)))
    o.append(eisen.box('buffer', (1.3, 0.12, 0.2), (0, -2.95, 0.55), m.steel))
    o.append(eisen.box('buffer2', (1.3, 0.12, 0.2), (0, 2.95, 0.55), m.steel))
    return eisen.parent_all(o, 'loco')


def cargo_wagon(m):
    body = anlagen.paint('#5f6b52', 'b_wagon')
    o = []
    for y in (-2.0, 2.0):
        o.append(eisen.box(f'bogie{y}', (1.2, 1.4, 0.3), (0, y, 0.3), m.dark, bevel=0.05))
        for x in (-0.45, 0.45):
            for dy in (-0.4, 0.4):
                o.append(eisen.cylinder(f'wh{y}{x}{dy}', 0.22, 0.12, (x, y + dy, 0.24), m.steel, segments=16, rot=(0, math.pi / 2, 0)))
    o.append(eisen.box('frame', (1.5, 5.8, 0.2), (0, 0, 0.55), m.dark, bevel=0.04))
    o.append(eisen.box('box', (1.5, 5.5, 1.1), (0, 0, 1.2), body, bevel=0.08))
    for k in range(7):
        o.append(eisen.box(f'rib{k}', (1.54, 0.06, 1.0), (0, -2.4 + k * 0.8, 1.2), m.dark))
    o.append(eisen.box('roof', (1.4, 5.4, 0.12), (0, 0, 1.8), m.steel, bevel=0.04))
    for y in (-2.95, 2.95):
        o.append(eisen.box(f'buf{y}', (1.3, 0.12, 0.2), (0, y, 0.55), m.steel))
    return eisen.parent_all(o, 'wagon')


def train_stop(m):
    """Bahnhof 2×2: Bahnsteig, Pfosten mit Schild und Lampe (Gleis liegt links in Fahrtrichtung)."""
    o = [eisen.box('plat', (1.9, 1.9, 0.2), (0, 0, 0.1), m.concrete, bevel=0.03)]
    sign = anlagen.paint('#c9a23a', 'b_sign')
    o.append(beam('post', (-0.6, 0.6, 0.2), (-0.6, 0.6, 2.2), (0.12, 0.12), m.steel))
    o.append(eisen.box('board', (0.08, 0.9, 0.5), (-0.65, 0.6, 2.0), sign, bevel=0.02))
    lamp = eisen.emission_material('b_stoplamp', (1.0, 0.6, 0.2), 4.0)
    o.append(eisen.cylinder('lamp', 0.1, 0.12, (-0.6, 0.6, 2.35), lamp, segments=12))
    o.append(eisen.box('bench', (0.4, 0.9, 0.3), (0.5, -0.2, 0.35), m.dark, bevel=0.03))
    return eisen.parent_all(o, 'stop')


def combinator(m, mode):
    """Konstanter Kombinator 1×1 bzw. Rechen-/Entscheidungskombinator 1×2 (Ausgang nach Norden)."""
    o = []
    col = {'constant': '#6a6a66', 'arithmetic': '#4f6a8a', 'decider': '#7a5a3a'}[mode]
    body = anlagen.paint(col, 'b_comb' + mode)
    if mode == 'constant':
        o.append(eisen.box('body', (0.8, 0.8, 0.35), (0, 0, 0.18), body, bevel=0.05))
        o.append(eisen.box('panel', (0.5, 0.5, 0.04), (0, 0, 0.37), m.dark))
        for k in range(3):
            led = eisen.emission_material(f'b_led{k}', (1.0, 0.4, 0.2), 3.0)
            o.append(eisen.box(f'led{k}', (0.08, 0.08, 0.03), (-0.15 + k * 0.15, 0.1, 0.4), led))
    else:
        o.append(eisen.box('body', (0.8, 1.6, 0.4), (0, 0, 0.2), body, bevel=0.06))
        o.append(eisen.box('screen', (0.5, 0.5, 0.04), (0, 0, 0.42), m.dark))
        glow = eisen.emission_material('b_scr' + mode, (0.3, 0.9, 0.5), 2.5)
        o.append(eisen.box('sym', (0.3, 0.06, 0.02), (0, 0, 0.45), glow))
        if mode == 'arithmetic':
            o.append(eisen.box('sym2', (0.06, 0.3, 0.02), (0, 0, 0.45), glow))
        # Anschlüsse: Eingang hinten (Süden), Ausgang vorn (Norden)
        for y, c in ((-0.65, m.copper), (0.65, m.bright)):
            for x in (-0.2, 0.2):
                o.append(eisen.cylinder(f'term{y}{x}', 0.05, 0.25, (x, y, 0.5), c, segments=10))
    bolts(o, m.bright, [(x, y) for x in (-0.3, 0.3) for y in ((-0.3, 0.3) if mode == 'constant' else (-0.7, 0.7))], 0.0, 0.02)
    return eisen.parent_all(o, 'comb')
