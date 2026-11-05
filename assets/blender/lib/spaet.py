"""Modelle des späten Spiels (Bibliothek): Leuchtfeuer, Roboterhangar, Roboter (fliegend mit Schatten), Logistikkisten,
Radar (drehende Antenne), Raketensilo und Fracht-Landeplatz."""
import math

import anlagen
import bauten
import eisen
from bauten import beam, bolts

CHESTS = {
    'passive-provider-chest': '#a8473c', 'active-provider-chest': '#7d4a9a', 'storage-chest': '#b8962e',
    'requester-chest': '#3f6aa0', 'buffer-chest': '#4c8a4a',
}


def beacon(m, lv=0.0):
    """Leuchtfeuer 3×3: Sockel, Mast mit Sendeschüssel und leuchtendem Ring (lv: Leuchtstärke)."""
    o = [eisen.box('pad', (2.8, 2.8, 0.14), (0, 0, 0.07), m.dark, bevel=0.03)]
    body = anlagen.paint('#4a5560', 'a_beacon')
    o.append(eisen.box('base', (2.0, 2.0, 0.5), (0, 0, 0.39), body, bevel=0.08))
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'slot{sx}{sy}', (0.4, 0.4, 0.06), (sx * 0.55, sy * 0.55, 0.66), m.dark, bevel=0.02))
    o.append(eisen.cylinder('mast', 0.18, 1.1, (0, 0, 1.15), m.steel, segments=16))
    ring = eisen.emission_material('beaconring', (0.4, 0.75, 1.0), 0.3 + 8.0 * lv)
    o.append(eisen.cylinder('ring', 0.42, 0.08, (0, 0, 1.55), ring, segments=28, bevel=0.03))
    o.append(eisen.cylinder('dish', 0.7, 0.1, (0, 0, 1.75), m.bright, segments=32, bevel=0.04))
    o.append(eisen.cylinder('tip', 0.08, 0.3, (0, 0, 1.95), m.copper, segments=12))
    bolts(o, m.bright, [(x, y) for x in (-1.25, 1.25) for y in (-1.25, 1.25)], 0.15, 0.03)
    return eisen.parent_all(o, 'beacon')


def roboport(m):
    """Roboterhangar 4×4: Betonsockel, Gehäuse mit vier Ladeplattformen an den Ecken und Antenne."""
    o = [eisen.box('pad', (3.85, 3.85, 0.14), (0, 0, 0.07), m.concrete, bevel=0.03)]
    body = anlagen.paint('#5b5f62', 'a_robo')
    o.append(eisen.box('body', (2.6, 2.6, 1.1), (0, 0, 0.69), body, bevel=0.12))
    o.append(eisen.box('roof', (2.2, 2.2, 0.12), (0, 0, 1.3), m.dark, bevel=0.04))
    door = anlagen.paint('#c7932f', 'a_robodoor')
    o.append(eisen.box('hatch', (1.0, 1.0, 0.06), (0, 0, 1.38), door, bevel=0.03))
    lamp = eisen.emission_material('robolamp', (1.0, 0.7, 0.2), 3.0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.cylinder(f'plat{sx}{sy}', 0.32, 0.08, (sx * 1.45, sy * 1.45, 0.9), m.steel, segments=20))
            o.append(beam(f'arm{sx}{sy}', (sx * 1.1, sy * 1.1, 0.9), (sx * 1.45, sy * 1.45, 0.9), (0.1, 0.08), m.dark))
            o.append(eisen.cylinder(f'lamp{sx}{sy}', 0.05, 0.05, (sx * 1.45, sy * 1.45, 0.97), lamp, segments=10))
    o.append(eisen.cylinder('ant', 0.04, 1.0, (0.8, -0.8, 1.8), m.steel, segments=8))
    o.append(eisen.cylinder('anttip', 0.07, 0.07, (0.8, -0.8, 2.3), lamp, segments=10))
    return eisen.parent_all(o, 'roboport')


def robot(m, kind):
    """Roboter: Rumpf mit vier Rotorgondeln; Bauroboter orange, Logistikroboter blaugrau."""
    col = '#d0782a' if kind == 'construction' else '#5a7a9a'
    shell = anlagen.paint(col, 'a_bot' + kind)
    o = [eisen.cylinder('hull', 0.16, 0.14, (0, 0, 0), shell, segments=24, bevel=0.06)]
    o.append(eisen.cylinder('dome', 0.1, 0.06, (0, 0, 0.09), m.glass, segments=20, bevel=0.03))
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        x, y = math.cos(a) * 0.24, math.sin(a) * 0.24
        o.append(beam(f'strut{k}', (0, 0, 0), (x, y, 0), (0.04, 0.03), m.dark))
        o.append(eisen.cylinder(f'rotor{k}', 0.08, 0.03, (x, y, 0.02), m.steel, segments=16))
    eye = eisen.emission_material('boteye' + kind, (1.0, 0.85, 0.4) if kind == 'construction' else (0.5, 0.9, 1.0), 4.0)
    o.append(eisen.box('eye', (0.08, 0.02, 0.03), (0, -0.16, 0.0), eye))
    if kind == 'construction':
        o.append(beam('claw', (0, 0, -0.06), (0, -0.1, -0.16), (0.03, 0.03), m.bright))
    else:
        o.append(eisen.box('crate', (0.14, 0.12, 0.08), (0, 0, -0.1), m.dark, bevel=0.01))
    return eisen.parent_all(o, 'robot')


def logistic_chest(m, color):
    o = []
    body = bauten.weathered('a_lchest' + color[1:], color, metal=0.6, rough=0.42, rust=0.15, dust=0.35, edge=0.6, streaks=0.3)
    o.append(eisen.box('body', (0.84, 0.8, 0.52), (0, 0, 0.26), m.steel, bevel=0.03))
    o.append(eisen.box('band', (0.86, 0.82, 0.18), (0, 0, 0.3), body, bevel=0.02))
    o.append(eisen.box('lid', (0.88, 0.84, 0.1), (0, 0, 0.57), body, bevel=0.03))
    o.append(eisen.box('plate', (0.3, 0.02, 0.1), (0, -0.42, 0.3), m.bright, bevel=0.005))
    bolts(o, m.bright, [(x, -0.405) for x in (-0.33, 0.33)], 0.15, 0.015, 'Y')
    return eisen.parent_all(o, 'lchest')


def radar(m, phase):
    """Radar 3×3: Gittermast mit drehender Parabolantenne."""
    o = [eisen.box('pad', (2.6, 2.6, 0.14), (0, 0, 0.07), m.concrete, bevel=0.03)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(beam(f'leg{sx}{sy}', (sx * 0.9, sy * 0.9, 0.14), (sx * 0.2, sy * 0.2, 1.4), (0.08, 0.08), m.steel))
    o.append(eisen.box('cab', (0.7, 0.7, 0.5), (0, 0, 1.45), anlagen.paint('#6b6f52', 'a_radar'), bevel=0.05))
    a = phase * math.tau
    dish = []
    dish.append(eisen.box('dishbar', (1.9, 0.16, 0.1), (0, 0, 0), m.dark, bevel=0.02))
    dish.append(eisen.box('dishface', (1.8, 0.06, 0.8), (0, -0.14, 0.3), m.bright, bevel=0.03))
    dish.append(beam('feed', (0, -0.1, 0.3), (0, -0.7, 0.3), (0.04, 0.04), m.dark))
    d = eisen.parent_all(dish, 'dish')
    d.location = (0, 0, 1.85)
    d.rotation_euler = (0, 0, a)
    o.append(d)
    return eisen.parent_all(o, 'radar')


def rocket_silo(m):
    """Raketensilo 9×9: Betonplattform, runde Schachtöffnung mit zwei Klappen, Startturm und Tanks."""
    o = [eisen.box('pad', (8.8, 8.8, 0.3), (0, 0, 0.15), m.concrete, bevel=0.05)]
    rim = anlagen.paint('#d0b040', 'a_silorim')
    o.append(eisen.cylinder('rim', 3.0, 0.2, (0, 0, 0.4), rim, segments=48, bevel=0.04))
    o.append(eisen.cylinder('pit', 2.75, 0.06, (0, 0, 0.48), m.dark, segments=48))
    doors = anlagen.paint('#6b6f72', 'a_silodoor')
    for sx in (-1, 1):
        o.append(eisen.box(f'door{sx}', (2.6, 5.2, 0.12), (sx * 1.35, 0, 0.55), doors, bevel=0.05))
        for k in range(4):
            o.append(eisen.box(f'stripe{sx}{k}', (0.3, 5.0, 0.02), (sx * (0.4 + k * 0.6), 0, 0.62), m.dark))
    # Startturm
    tower = anlagen.paint('#8a3f2e', 'a_tower')
    for k in range(5):
        o.append(beam(f'tw{k}', (3.4, -1.0 + k * 0.5, 0.3), (3.4, -1.0 + k * 0.5, 5.0), (0.12, 0.12), tower))
    for z in (1.5, 2.8, 4.1):
        o.append(eisen.box(f'twbr{z}', (0.2, 2.2, 0.12), (3.4, 0, z), tower))
    o.append(eisen.box('arm', (1.0, 0.25, 0.2), (2.9, 0, 4.6), tower))
    for k, y in enumerate((-3.4, -2.2)):
        o.append(eisen.cylinder(f'tank{k}', 0.5, 1.6, (-3.3, y, 1.1), m.bright, segments=24, bevel=0.06))
    lamp = eisen.emission_material('silolamp', (1.0, 0.5, 0.15), 3.0)
    for a in range(8):
        r = 3.05
        o.append(eisen.cylinder(f'l{a}', 0.07, 0.06, (math.cos(a * math.pi / 4) * r, math.sin(a * math.pi / 4) * r, 0.53), lamp, segments=10))
    return eisen.parent_all(o, 'silo')


def landing_pad(m):
    """Fracht-Landeplatz 8×8: Betonfläche mit Markierung, Auffangrahmen und Lager."""
    o = [eisen.box('pad', (7.8, 7.8, 0.2), (0, 0, 0.1), m.concrete, bevel=0.05)]
    mark = anlagen.paint('#d0b040', 'a_padmark')
    for k, (x, y, w, h) in enumerate(((0, 2.6, 5.0, 0.25), (0, -2.6, 5.0, 0.25), (2.6, 0, 0.25, 5.0), (-2.6, 0, 0.25, 5.0))):
        o.append(eisen.box(f'mark{k}', (w, h, 0.02), (x, y, 0.21), mark))
    o.append(eisen.cylinder('circle', 1.6, 0.03, (0, 0, 0.22), mark, segments=48))
    o.append(eisen.cylinder('inner', 1.4, 0.04, (0, 0, 0.23), m.dark, segments=48))
    for sx in (-1, 1):
        for sy in (-1, 1):
            o.append(eisen.box(f'post{sx}{sy}', (0.5, 0.5, 1.6), (sx * 3.4, sy * 3.4, 0.9), anlagen.paint('#5b5f62', 'a_padpost'), bevel=0.05))
    o.append(eisen.box('store', (2.0, 1.2, 1.0), (2.4, -2.9, 0.7), m.steel, bevel=0.06))
    return eisen.parent_all(o, 'pad')
