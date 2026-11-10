"""Rüstungen und Ausrüstung (Symbole): schwere, modulare und Kraftrüstung als Brustpanzer im Endzeit-Stil,
persönlicher Roboterhangar (Platte mit zwei Startluken), tragbares Solarmodul, persönlicher Akku."""
import math

import eisen
import kleinteile


def finish(out, name, root, scale=1.0, z=0.0, rot=25):
    root.scale = (scale, scale, scale)
    root.location.z += z
    root.rotation_euler = (0, 0, math.radians(rot))
    eisen.camera(1, 1, anchor=(0.5, 0.56))
    out.add(name, 'items', [out.render_frame(name, 0)], (0.5, 0.5))


def armor(m, plate_hex, accent_hex, rivets=True, grid=False, visor=False):
    """Brustpanzer liegend: Brust- und Rückenplatte, Schulterstücke, Gürtel; Varianten mit Raster oder Leuchtstreifen."""
    o = []
    plate = kleinteile.W('r_plate', plate_hex, metal=0.6, rough=0.45, rust=0.35, dust=0.4, edge=0.7)
    accent = kleinteile.W('r_acc', accent_hex, metal=0.3, rough=0.55, rust=0.1, dust=0.3, edge=0.5)
    o.append(eisen.box('chest', (0.5, 0.62, 0.12), (0, 0, 0.08), plate, bevel=0.05))
    o.append(eisen.box('neck', (0.22, 0.08, 0.06), (0, 0.33, 0.13), m.dark, bevel=0.02))
    for s in (-1, 1):
        o.append(eisen.cylinder(f'sh{s}', 0.12, 0.2, (s * 0.31, 0.2, 0.12), accent, segments=20, bevel=0.03, rot=(0, math.pi / 2, 0)))
        o.append(eisen.box(f'strap{s}', (0.06, 0.5, 0.03), (s * 0.15, 0.0, 0.155), m.dark, bevel=0.01))
    o.append(eisen.box('belt', (0.54, 0.09, 0.08), (0, -0.28, 0.12), m.dark, bevel=0.02))
    o.append(eisen.box('buckle', (0.09, 0.07, 0.03), (0, -0.28, 0.17), m.bright, bevel=0.01))
    if rivets:
        for k, (x, y) in enumerate(((-0.2, 0.22), (0.2, 0.22), (-0.2, -0.18), (0.2, -0.18))):
            o.append(eisen.cylinder(f'rv{k}', 0.018, 0.02, (x, y, 0.145), m.bright, segments=10))
    if grid:
        for k in range(3):
            o.append(eisen.box(f'gx{k}', (0.34, 0.012, 0.012), (0, -0.1 + k * 0.1, 0.145), m.dark))
            o.append(eisen.box(f'gy{k}', (0.012, 0.3, 0.012), (-0.1 + k * 0.1, 0.0, 0.145), m.dark))
    if visor:
        glow = eisen.material('r_glow', eisen.srgb('#ffb04a'), rough=0.3, emission=eisen.srgb('#ff9a2a'), emission_strength=3.0)
        o.append(eisen.box('glow', (0.3, 0.035, 0.015), (0, 0.12, 0.15), glow, bevel=0.005))
        o.append(eisen.box('pack', (0.3, 0.2, 0.08), (0, -0.05, 0.17), accent, bevel=0.03))
    return eisen.parent_all(o, 'armor')


def roboport_eq(m):
    o = []
    o.append(eisen.box('base', (0.62, 0.62, 0.1), (0, 0, 0.05), m.paint, bevel=0.03))
    for s in (-1, 1):
        o.append(eisen.cylinder(f'hatch{s}', 0.12, 0.04, (s * 0.15, 0.05, 0.11), m.dark, segments=24, bevel=0.01))
        o.append(eisen.cylinder(f'ring{s}', 0.14, 0.02, (s * 0.15, 0.05, 0.1), m.steel, segments=24))
    o.append(eisen.box('stripe', (0.5, 0.08, 0.02), (0, -0.2, 0.105), m.hazard))
    o.append(eisen.cylinder('ant', 0.012, 0.18, (0.24, 0.24, 0.19), m.steel, segments=8))
    o.append(eisen.cylinder('tip', 0.025, 0.02, (0.24, 0.24, 0.29), m.bright, segments=10))
    return eisen.parent_all(o, 'roboeq')


def solar_eq(m):
    o = []
    o.append(eisen.box('frame', (0.6, 0.6, 0.06), (0, 0, 0.03), m.steel, bevel=0.02))
    cell = eisen.material('r_cell', eisen.srgb('#203a66'), rough=0.18, metal=0.4)
    for i in range(3):
        for j in range(3):
            o.append(eisen.box(f'c{i}{j}', (0.17, 0.17, 0.02), (-0.185 + i * 0.185, -0.185 + j * 0.185, 0.065), cell, bevel=0.004))
    return eisen.parent_all(o, 'solareq')


def battery_eq(m):
    o = []
    green = kleinteile.W('r_bat', '#4d6a3a', metal=0.3, rough=0.5, rust=0.1, dust=0.3, edge=0.5)
    o.append(eisen.box('body', (0.36, 0.7, 0.16), (0, 0, 0.08), green, bevel=0.04))
    o.append(eisen.box('label', (0.3, 0.2, 0.01), (0, 0.05, 0.165), m.paint))
    for s in (-1, 1):
        o.append(eisen.cylinder(f't{s}', 0.04, 0.05, (s * 0.09, 0.3, 0.17), m.bright if s > 0 else m.dark, segments=12))
    return eisen.parent_all(o, 'battery')


def render(out):
    for name, kw in (('item.heavy-armor', dict(plate_hex='#5a5c56', accent_hex='#6b4a2e', rivets=True)),
                     ('item.modular-armor', dict(plate_hex='#4a5866', accent_hex='#3d4048', rivets=False, grid=True)),
                     ('item.power-armor', dict(plate_hex='#3e4a3c', accent_hex='#2e322e', rivets=False, grid=True, visor=True))):
        eisen.reset(samples=48)
        finish(out, name, armor(kleinteile.Mats('#5d6248', 2), **kw), 1.05, -0.05)
    for name, fn, sc in (('item.personal-roboport-equipment', roboport_eq, 1.05), ('item.solar-panel-equipment', solar_eq, 1.1),
                         ('item.battery-equipment', battery_eq, 1.1)):
        eisen.reset(samples=48)
        finish(out, name, fn(kleinteile.Mats('#5d6248', 2)), sc, -0.05)
