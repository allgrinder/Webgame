"""Solarpanel 3×3 (Zellenfeld auf Stahlrahmen) und Akkumulator 2×2 (drei Zellensäulen mit Ladeanzeige und
Leuchtebene beim Laden/Entladen), dazu ihre Item-Symbole."""
import math

import anlagen
import eisen
from bauten import beam, bolts

ICON_ANCHOR = (0.5, 0.56)


def solar_panel(m):
    o = []
    cell = eisen.material('s_cell', eisen.srgb('#1d2a44'), rough=0.12, metal=0.35, noise=0.08, noise_scale=40)
    grid = eisen.material('s_grid', eisen.srgb('#9aa3ad'), rough=0.35, metal=0.8)
    tilt = math.radians(12)
    o.append(eisen.box('frame', (2.85, 2.85, 0.08), (0, 0, 0.5), m.steel, bevel=0.03, rot=(tilt, 0, 0)))
    n = 6
    size = 2.7 / n
    for i in range(n):
        for j in range(n):
            x = -1.35 + size * (i + 0.5)
            y = -1.35 + size * (j + 0.5)
            o.append(eisen.box(f'c{i}{j}', (size - 0.04, size - 0.04, 0.03),
                               (x, y * math.cos(tilt), 0.55 + y * math.sin(tilt)), cell, rot=(tilt, 0, 0)))
    for k in range(n + 1):
        y = -1.35 + size * k
        o.append(eisen.box(f'gy{k}', (2.72, 0.02, 0.035), (0, y * math.cos(tilt), 0.565 + y * math.sin(tilt)), grid, rot=(tilt, 0, 0)))
        x = -1.35 + size * k
        o.append(eisen.box(f'gx{k}', (0.02, 2.72, 0.035), (x, 0, 0.565), grid, rot=(tilt, 0, 0)))
    for sx in (-1.1, 1.1):
        for sy in (-1.1, 1.1):
            h = 0.5 + sy * math.sin(tilt)
            o.append(beam(f'leg{sx}{sy}', (sx, sy, 0.0), (sx, sy * math.cos(tilt), h - 0.05), (0.08, 0.08), m.dark))
    o.append(eisen.box('box', (0.3, 0.2, 0.25), (1.1, -1.3, 0.13), m.dark, bevel=0.02))
    return eisen.parent_all(o, 'solar')


def accumulator(m, level=0.0):
    o = []
    o.append(eisen.box('pad', (1.85, 1.85, 0.12), (0, 0, 0.06), m.concrete, bevel=0.03))
    body = anlagen.paint('#5a6066', 'a_accu')
    for k, x in enumerate((-0.55, 0.0, 0.55)):
        o.append(eisen.cylinder(f'cell{k}', 0.24, 1.2, (x, 0.15, 0.72), body, segments=24, bevel=0.04))
        o.append(eisen.cylinder(f'cap{k}', 0.2, 0.08, (x, 0.15, 1.36), m.dark, segments=24, bevel=0.02))
        o.append(eisen.cylinder(f'term{k}', 0.05, 0.12, (x, 0.15, 1.45), m.copper, segments=12))
        for z in (0.4, 1.0):
            o.append(eisen.cylinder(f'band{k}{z}', 0.25, 0.05, (x, 0.15, z), m.dark, segments=24))
    o.append(beam('bus', (-0.55, 0.15, 1.5), (0.55, 0.15, 1.5), (0.05, 0.05), m.copper))
    # Ladeanzeige vorn: vier Segmente, leuchten je nach level (0..1)
    o.append(eisen.box('panel', (1.1, 0.08, 0.32), (0, -0.62, 0.42), m.dark, bevel=0.02))
    for k in range(4):
        on = level > 0 and k < round(level * 4 + 0.49)
        mat = eisen.emission_material(f'led{k}', (0.35, 0.8, 1.0), 6.0 if on else 0.15)
        o.append(eisen.box(f'led{k}', (0.18, 0.02, 0.12), (-0.36 + k * 0.24, -0.67, 0.42), mat))
    bolts(o, m.bright, [(x, y) for x in (-0.82, 0.82) for y in (-0.82, 0.82)], 0.12, 0.025)
    return eisen.parent_all(o, 'accumulator')


def icon(out, name, root, scale):
    root.scale = (scale, scale, scale)
    root.location.z -= 0.05
    eisen.camera(1, 1, anchor=ICON_ANCHOR)
    out.add(name, 'items', [out.render_frame(name, 0)], (0.5, 0.5))


def render(out):
    anlagen.building(out, 'solar-panel', lambda m, ph: solar_panel(m), (3.5, 4.0), (0.5, 2.2 / 4.0),
                     (4.5, 4.5), (1.9 / 4.5, 1.9 / 4.5), frames=1, samples=40)
    anlagen.building(out, 'accumulator', lambda m, ph: accumulator(m, 0.0), (2.5, 3.5), (0.5, 2.2 / 3.5),
                     (3.5, 3.5), (1.25 / 3.5, 1.25 / 3.5), frames=1, samples=40,
                     glow=((0.25, 0.5, 0.75, 1.0), lambda m, lv: accumulator(m, lv)))
    eisen.reset(samples=48)
    icon(out, 'item.solar-panel', solar_panel(anlagen.Mats()), 0.3)
    eisen.reset(samples=48)
    icon(out, 'item.accumulator', accumulator(anlagen.Mats(), 0.0), 0.42)
