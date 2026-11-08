"""Kernkraft: Kernreaktor (Leuchtebene), Wärmerohr (16 Anschlussmasken + Glühen), Wärmetauscher (4 Richtungen,
Glühen), Dampfturbine (4 Richtungen, Kupplung dreht), Zentrifuge (Deckel drehen, Leuchtringe), Symbole."""
import math

import anlagen
import eisen
import kernkraft
import parts

ALL = (0, 1, 2, 3)


def finish_icon(out, name, root, scale=1.0, z=0.0):
    root.scale = (scale, scale, scale)
    root.location.z += z
    eisen.camera(1, 1, anchor=(0.5, 0.56))
    out.add(name, 'items', [out.render_frame(name, 0)], (0.5, 0.5))


def pellet(color, emissive):
    o = []
    mat = eisen.emission_material('pel', color, 2.5) if emissive else eisen.material('pel', color, rough=0.4, metal=0.3)
    for k, (x, y) in enumerate(((-0.12, 0.0), (0.12, 0.05), (0.0, 0.18))):
        o.append(eisen.cylinder(f'p{k}', 0.12, 0.2, (x, y, 0.1 + 0.02 * k), mat, segments=16, bevel=0.03))
    return eisen.parent_all(o, 'pellet')


def fuel_cell(depleted):
    m = kernkraft.Mats(0.0 if depleted else 1.0)
    o = [eisen.cylinder('rod', 0.12, 0.8, (0, 0, 0.42), m.t.metal, segments=20, bevel=0.03)]
    for z in (0.15, 0.42, 0.69):
        o.append(eisen.cylinder(f'b{z}', 0.13, 0.05, (0, 0, z), m.t.frame, segments=20))
    o.append(eisen.box('win', (0.05, 0.24, 0.5), (0.12, 0, 0.42), m.core if not depleted else m.dark))
    root = eisen.parent_all(o, 'cell')
    root.rotation_euler = (math.radians(60), 0, math.radians(30))
    return root


def render(out):
    anlagen.building(out, 'nuclear-reactor', lambda m, ph: kernkraft.reactor(m, 0.0), (6.5, 7.75), (0.5, 4.4 / 7.75),
                     (8.5, 8.5), (3.5 / 8.5, 3.5 / 8.5), frames=1, samples=40,
                     glow=((0.7, 1.0, 0.85, 1.0), lambda m, lv: kernkraft.reactor(m, lv)))
    anlagen.building(out, 'heat-exchanger', lambda m, ph: kernkraft.heat_exchanger(m, 0.0), (3.75, 4.0), (0.5, 2.3 / 4.0),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), dirs=ALL, frames=1, samples=40,
                     glow=((1.0,), lambda m, lv: kernkraft.heat_exchanger(m, lv)))
    anlagen.building(out, 'steam-turbine', kernkraft.steam_turbine, (5.75, 6.5), (0.5, 3.6 / 6.5),
                     (6.75, 6.75), (3.0 / 6.75, 3.0 / 6.75), dirs=ALL, frames=8, samples=32, fps=30)
    anlagen.building(out, 'centrifuge', lambda m, ph: kernkraft.centrifuge(m, ph), (3.75, 4.5), (0.5, 2.6 / 4.5),
                     (4.75, 4.75), (1.5 / 4.75, 1.5 / 4.75), frames=16, samples=32, fps=30,
                     glow=((1.0,), lambda m, lv: kernkraft.centrifuge(m, 0.0, lv)))
    # Wärmerohr: 16 Masken, je Grundbild und Glühen (Differenz wie bei den Gebäuden)
    canvas, anchor = (1.25, 1.5), (0.5, 0.8 / 1.5)
    for mask in range(16):
        eisen.reset(samples=32)
        kernkraft.heat_pipe(mask)
        eisen.camera(*canvas, anchor=anchor)
        name = f'heat-pipe.{mask}'
        base_path = out.render_frame(name, 0)
        out.add(name, 'entities', [base_path], anchor)
        base, w, h = anlagen.load_pixels(base_path)
        eisen.reset(samples=32)
        kernkraft.heat_pipe(mask, 1.0)
        eisen.camera(*canvas, anchor=anchor)
        tmp = out.frame_path(f'{name}.glowsrc', 0)
        eisen.render_to(tmp)
        full, _, _ = anlagen.load_pixels(tmp)
        p = out.frame_path(f'heat-pipe.glow.{mask}', 0)
        anlagen.write_glow_diff(full, base, w, h, p, tint=(1.0, 0.5, 0.2), gain=1.8)
        out.add(f'heat-pipe.glow.{mask}', 'entities', [p], anchor, meta={'blend': 'add'})
    # Symbole
    icons = (
        ('item.nuclear-reactor', lambda: kernkraft.reactor(None), 0.17),
        ('item.heat-exchanger', lambda: kernkraft.heat_exchanger(None), 0.3),
        ('item.steam-turbine', lambda: kernkraft.steam_turbine(None), 0.19),
        ('item.centrifuge', lambda: kernkraft.centrifuge(None), 0.3),
        ('item.heat-pipe', lambda: kernkraft.heat_pipe(5), 0.9),
        ('item.uranium-235', lambda: pellet((0.3, 1.0, 0.35), True), 1.3),
        ('item.uranium-238', lambda: pellet(eisen.srgb('#3f4a3a'), False), 1.3),
        ('item.uranium-fuel-cell', lambda: fuel_cell(False), 0.9),
        ('item.depleted-uranium-fuel-cell', lambda: fuel_cell(True), 0.9),
        ('item.steam-hot', lambda: anlagen.fluid_barrel(anlagen.Mats(), eisen.srgb('#f0e8e0')), 1.25),
    )
    for name, fn, sc in icons:
        eisen.reset(samples=48)
        root = fn()
        if name in ('item.steam-turbine',):
            root.rotation_euler = (0, 0, math.pi / 2)
        finish_icon(out, name, root, sc, -0.05)
    # Uranerz-Symbol: grünliche Brocken
    eisen.reset(samples=48)
    m = parts.Mats()
    mat = eisen.material('urore', eisen.srgb('#5a8a3a'), rough=0.6)
    o = [eisen.rock(f'r{k}', 0.16 + 0.03 * k, (math.cos(k * 2.1) * 0.15, math.sin(k * 2.1) * 0.15, 0.1), mat, 50 + k) for k in range(4)]
    finish_icon(out, 'item.uranium-ore', eisen.parent_all(o, 'uore'), 1.0, 0.0)
    del m
