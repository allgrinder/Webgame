"""Bohrer (eigene Formen): drehendes Bohrwerk als Blickfang.

Brennstoff-Bohrer 2×2 (Stufe 1): genieteter Gusskörper, liegendes Schwungrad mit Kurbel und Kolben, Schornstein
(Rauchpunkt 0.55/0.35/1.42, src/data/fx.ts), Feuerklappe Süd, Rutsche Nord über der linken Hälfte.
Elektrischer Bohrer 3×3 (Stufe 2): Rahmen mit Stützfüßen, großer Drehkopf mit drei Antriebsgondeln, Motorkasten,
Rutsche Nord Mitte. Beide für Richtung Nord, mittig um den Ursprung.
"""
import math
import random

import bauten
import eisen
import gw_ground
import kit
from bauten import beam, pipe

lin = gw_ground.lin


def _spoil(o, seed, inside, n, scale=1.0):
    rnd = random.Random(seed)
    earth = [gw_ground.pmat(f'bsp{seed}{i}', lin(h), 1.0, 0.3, 0.6, 25) for i, h in enumerate(['#4f3f2e', '#5d4a35', '#6b6458', '#3e3226'])]
    st = bauten.stones(n, rnd, earth, inside, (0.025, 0.06))
    for s in st:
        s.location.x *= scale
        s.location.y *= scale
    o.extend(st)


def spoked_wheel(o, name, r, loc, angle, rim_mat, spoke_mat, hub_mat, spokes=6, w=0.07):
    """Liegendes Speichenrad (Achse Z)."""
    x, y, z = loc
    rim = eisen.cylinder(name + 'rim', r, w, (x, y, z), rim_mat, segments=48)
    cut = eisen.cylinder(name + 'cut', r - 0.07, w * 3, (x, y, z), rim_mat, segments=48)
    m = rim.modifiers.new('hole', 'BOOLEAN')
    m.object = cut
    m.operation = 'DIFFERENCE'
    cut.hide_render = True
    cut.parent = rim  # dreht mit (Richtungen 1–3)
    cut.location = (0, 0, 0)
    o.append(rim)
    for k in range(spokes):
        b = angle + k / spokes * math.tau
        o.append(beam(f'{name}sp{k}', (x, y, z), (x + math.cos(b) * (r - 0.04), y + math.sin(b) * (r - 0.04), z), (0.05, 0.04), spoke_mat))
    o.append(eisen.cylinder(name + 'hub', r * 0.2, w * 1.6, (x, y, z), hub_mat, segments=20, bevel=0.01))
    # Markierung am Kranz (macht die Drehung sichtbar)
    o.append(eisen.box(name + 'mark', (0.1, 0.05, w + 0.01), (x + math.cos(angle) * (r - 0.035), y + math.sin(angle) * (r - 0.035), z),
                       hub_mat, rot=(0, 0, angle + math.pi / 2)))


# --------------------------------------------------------------------------- Brennstoff-Bohrer 2×2

def burner_drill(_m=None, phase=0.0, working=True):
    t = kit.Tier(1, accent='#6c5631', prefix='bd')
    body = bauten.weathered('bdbody', '#5a4a30', metal=0.45, rough=0.55, rust=0.45, dust=0.25, edge=0.7, streaks=0.5)
    rnd = kit.rng(21)
    o = []
    # Fundament: gegossene Platte mit Füßen
    o.append(eisen.box('base', (1.88, 1.88, 0.12), (0, 0, 0.06), t.frame, bevel=0.04))
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'foot{sx}{sy}', (0.26, 0.26, 0.08), (sx * 0.82, sy * 0.82, 0.14), t.dark, bevel=0.02))
    # Körper: gefaste Wanne mit Nietreihen
    o.append(eisen.box('body', (1.6, 1.5, 0.56), (0, -0.05, 0.42), body, bevel=0.1))
    o.append(eisen.box('rimband', (1.64, 1.54, 0.06), (0, -0.05, 0.66), t.frame, bevel=0.015))
    for k in range(9):
        x = -0.72 + k * 0.18
        for y in (-0.82, 0.72):
            o.append(eisen.cylinder(f'rv{k}{y}', 0.016, 0.02, (x, y, 0.62), t.metal, segments=6, rot=(math.pi / 2, 0, 0)))
    o.append(eisen.box('deck', (1.44, 1.34, 0.05), (0, -0.05, 0.71), t.dark, bevel=0.01))
    # Schwungrad (dreht) und Getriebeglocke
    a = phase * math.tau
    wx, wy, wz = -0.22, -0.08, 0.86
    o.append(eisen.cylinder('bell', 0.24, 0.12, (wx, wy, 0.78), t.metal, segments=28, bevel=0.02))
    spoked_wheel(o, 'fw', 0.5, (wx, wy, wz), a, t.frame, t.accent, t.metal)
    # Kurbel und Pleuel zum Kolben
    cx, cy = wx + math.cos(a) * 0.32, wy + math.sin(a) * 0.32
    o.append(eisen.cylinder('pin', 0.035, 0.1, (cx, cy, wz + 0.06), t.metal, segments=10))
    px, py = 0.5, -0.5
    o.append(eisen.cylinder('cyl', 0.13, 0.42, (px, py, 0.93), t.panels[2], segments=24, bevel=0.02))
    o.append(eisen.cylinder('cylcap', 0.15, 0.05, (px, py, 1.15), t.frame, segments=24))
    lift = 0.06 * math.sin(a)
    o.append(eisen.cylinder('rod', 0.04, 0.3, (px, py, 1.25 + lift), t.metal, segments=12))
    o.append(beam('conrod', (cx, cy, wz + 0.1), (px, py, 1.38 + lift), (0.045, 0.04), t.metal))
    # Schornstein mit Ruß (Rauchpunkt)
    o.append(eisen.cylinder('stack', 0.1, 0.72, (0.55, 0.35, 1.04), t.metal, segments=16))
    for z in (0.85, 1.2):
        o.append(eisen.cylinder(f'stb{z}', 0.115, 0.04, (0.55, 0.35, z), t.frame, segments=16))
    o.append(eisen.cylinder('stacktop', 0.14, 0.05, (0.55, 0.35, 1.39), t.dark, segments=16))
    o.append(eisen.cylinder('soot', 0.085, 0.01, (0.55, 0.35, 1.42), eisen.material('bdsoot', (0.008, 0.008, 0.008), rough=1), segments=12))
    # Feuerklappe Süd mit Glut, Kohlekasten
    o.append(eisen.box('hatch', (0.44, 0.05, 0.28), (0.3, -0.82, 0.4), t.dark, bevel=0.01))
    o.append(eisen.box('hatchglow', (0.32, 0.02, 0.06), (0.3, -0.855, 0.34), eisen.emission_material('bdember', (1.0, 0.35, 0.08), 3.0 if working else 0.0)))
    for k in range(4):
        o.append(eisen.box(f'grill{k}', (0.02, 0.02, 0.2), (0.18 + k * 0.08, -0.86, 0.42), t.metal))
    o.append(eisen.box('hopper', (0.34, 0.24, 0.16), (-0.48, -0.86, 0.28), t.wood, bevel=0.01))
    # Ausgaberutsche Nord über der linken Hälfte
    o.append(eisen.box('chute', (0.44, 0.52, 0.16), (-0.35, 0.82, 0.32), t.accent, bevel=0.015, rot=(math.radians(-18), 0, 0)))
    o.append(eisen.box('chuteIn', (0.32, 0.48, 0.05), (-0.35, 0.84, 0.39), t.inner, rot=(math.radians(-18), 0, 0)))
    kit.greebles(o, rnd, 0.15, 0.2, 0.7, 0.6, 0.735, 3, t, hmax=0.06)
    _spoil(o, 41, lambda x, y: (0.92 < max(abs(x), abs(y)) < 0.99) and not (y > 0.85 and -0.6 < x < -0.1), 80)
    return eisen.parent_all(o, 'drill')


# --------------------------------------------------------------------------- Elektrischer Bohrer 3×3

def electric_drill(_m=None, phase=0.0):
    t = kit.Tier(2, accent='#8a7232', prefix='ed')
    head_mat = bauten.weathered('edhead', '#7a6530', metal=0.35, rough=0.5, rust=0.25, dust=0.3, edge=0.65, streaks=0.3)
    rnd = kit.rng(22)
    o = []
    # Rahmen und Stützfüße an den Ecken
    o.append(eisen.box('frame', (2.5, 2.5, 0.18), (0, 0, 0.12), t.frame, bevel=0.03))
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'pad{sx}{sy}', (0.36, 0.36, 0.06), (sx * 1.24, sy * 1.24, 0.03), t.dark, bevel=0.015))
            o.append(beam(f'leg{sx}{sy}', (sx * 0.95, sy * 0.95, 0.32), (sx * 1.24, sy * 1.24, 0.07), (0.12, 0.1), t.accent))
            o.append(eisen.cylinder(f'hyd{sx}{sy}', 0.05, 0.3, (sx * 1.12, sy * 1.12, 0.25), t.metal, segments=10))
    # Unterbau: Gehäuse mit Rippen
    o.append(eisen.box('housing', (2.1, 2.1, 0.46), (0, 0, 0.44), t.panels[1], bevel=0.08))
    for k in range(5):
        x = -0.8 + k * 0.4
        o.append(eisen.box(f'ribS{k}', (0.05, 0.03, 0.34), (x, -1.06, 0.44), t.frame))
    o.append(eisen.box('deck', (2.0, 2.0, 0.05), (0, 0, 0.69), t.frame, bevel=0.01))
    # Drehkranz (fest) und Drehkopf (dreht: 1/3 Umdrehung je Schleife, dreifach symmetrisch)
    o.append(eisen.cylinder('ring', 0.98, 0.12, (0, 0, 0.77), t.dark, segments=56, bevel=0.02))
    for k in range(24):
        b = k / 24 * math.tau
        o.append(eisen.cylinder(f'rb{k}', 0.018, 0.02, (math.cos(b) * 0.93, math.sin(b) * 0.93, 0.84), t.metal, segments=6))
    a = phase * math.tau / 3
    o.append(eisen.cylinder('head', 0.86, 0.2, (0, 0, 0.93), head_mat, segments=56, bevel=0.03))
    # Warnstreifen-Segmente am Rand des Drehkopfs (zeigen die Drehung)
    for k in range(6):
        b = a + k / 6 * math.tau
        o.append(eisen.box(f'haz{k}', (0.3, 0.06, 0.02), (math.cos(b) * 0.74, math.sin(b) * 0.74, 1.035), t.hazard, rot=(0, 0, b + math.pi / 2)))
    for k in range(3):
        b = a + k / 3 * math.tau + math.pi / 6
        mx, my = math.cos(b) * 0.5, math.sin(b) * 0.5
        pod = eisen.box(f'pod{k}', (0.42, 0.3, 0.26), (mx, my, 1.16), t.panels[0], bevel=0.04, rot=(0, 0, b))
        o.append(pod)
        for f in range(4):
            off = -0.12 + f * 0.08
            o.append(eisen.box(f'podfin{k}{f}', (0.34, 0.02, 0.05), (mx - math.sin(b) * off, my + math.cos(b) * off, 1.31), t.metal, rot=(0, 0, b)))
        o.append(eisen.cylinder(f'podlamp{k}', 0.025, 0.02, (math.cos(b) * 0.76, math.sin(b) * 0.76, 1.06), kit.glow(f'edl{k}', '#ffb347', 3.0), segments=8))
    o.append(eisen.cylinder('collar', 0.26, 0.34, (0, 0, 1.2), t.metal, segments=32, bevel=0.03))
    o.append(eisen.cylinder('cap', 0.18, 0.06, (0, 0, 1.39), t.dark, segments=32, bevel=0.01))
    o.append(eisen.box('capmark', (0.2, 0.04, 0.02), (math.cos(a) * 0.08, math.sin(a) * 0.08, 1.43), t.hazard, rot=(0, 0, a)))
    # Motorkasten Ost mit Kühlrippen, Kabel, Schaltkasten Südwest
    o.append(eisen.box('motor', (0.36, 0.9, 0.42), (1.0, -0.15, 0.92), t.panels[0], bevel=0.04))
    for k in range(8):
        o.append(eisen.box(f'mfin{k}', (0.38, 0.025, 0.08), (1.0, -0.52 + k * 0.105, 1.15), t.metal))
    kit.cable(o, 'cab', [(0.9, 0.3, 1.0), (0.6, 0.62, 0.95), (0.25, 0.4, 1.05)], 0.025, t.rubber)
    o.append(eisen.box('cbox', (0.36, 0.22, 0.34), (-0.95, -1.0, 0.82), t.frame, bevel=0.02))
    o.append(eisen.box('cboxlamp', (0.08, 0.015, 0.05), (-0.95, -1.115, 0.9), kit.glow('edlamp', '#7dff6a', 3.0)))
    kit.ladder(o, 'lad', -1.08, 0.5, 0.2, 0.72, t.metal, facing='X')
    # Ausgaberutsche Nord (Mitte)
    o.append(eisen.box('chute', (0.5, 0.78, 0.2), (0, 1.12, 0.46), t.accent, bevel=0.02, rot=(math.radians(-15), 0, 0)))
    o.append(eisen.box('chuteIn', (0.36, 0.72, 0.06), (0, 1.15, 0.54), t.inner, rot=(math.radians(-15), 0, 0)))
    kit.greebles(o, rnd, -0.95, 0.55, -0.55, 0.95, 0.715, 3, t, hmax=0.08)
    _spoil(o, 77, lambda x, y: 0.93 < max(abs(x), abs(y)) < 0.995 and not (y > 0.9 and abs(x) < 0.3), 120, scale=1.5)
    return eisen.parent_all(o, 'edrill')
