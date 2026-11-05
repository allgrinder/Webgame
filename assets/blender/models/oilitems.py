"""Item-Symbole der Ölstufe (Zwischenprodukte, Anlagen, Express-Logistik) und Flüssigkeitssymbole (Fass mit Farbband).
Gleiche Kamera und Beleuchtung wie items.py."""
import math

import anlagen
import stufe23
import bauten
import eisen
import parts

FLUIDS = {
    'water': '#3a6f9a', 'steam': '#d8d8d8', 'crude-oil': '#2a2018', 'heavy-oil': '#a04a18', 'light-oil': '#c8a020',
    'petroleum-gas': '#5a3a6a', 'lubricant': '#2e7a3a', 'sulfuric-acid': '#c8c020',
}
EXPRESS = '#3a5a7c'


def finish(out, name, root=None, scale=1.0, z=0.0):
    if root is not None:
        root.scale = (scale, scale, scale)
        root.location.z += z
    eisen.camera(1, 1, anchor=(0.5, 0.56))
    out.add(name, 'items', [out.render_frame(name, 0)], (0.5, 0.5))


def belt_piece(m):
    objs = [
        eisen.box('surface', (0.7, 0.9, 0.05), (0, 0, 0.06), m.rubber),
        eisen.box('railL', (0.08, 0.92, 0.14), (-0.39, 0, 0.07), m.ochre, bevel=0.01),
        eisen.box('railR', (0.08, 0.92, 0.14), (0.39, 0, 0.07), m.ochre, bevel=0.01),
    ]
    for i in range(4):
        objs.append(eisen.box(f'rib{i}', (0.7, 0.05, 0.02), (0, -0.33 + i * 0.22, 0.095), m.dark))
    return eisen.parent_all(objs)


def render(out):
    simple = [
        ('plastic-bar', anlagen.plastic_bars, 1.15),
        ('sulfur', anlagen.sulfur_pile, 1.3),
        ('battery', anlagen.battery_cell, 1.15),
        ('solid-fuel', anlagen.solid_fuel, 1.15),
        ('explosives', anlagen.explosives_box, 1.0),
        ('advanced-circuit', anlagen.advanced_circuit, 1.1),
        ('electric-engine-unit', anlagen.electric_engine, 1.25),
        ('pumpjack', lambda m: stufe23.pumpjack2(m, 0.0), 0.27),
        ('oil-refinery', lambda m: stufe23.oil_refinery2(m, 0.0), 0.16),
        ('chemical-plant', lambda m: stufe23.chemical_plant2(m, 0.0), 0.3),
        ('electric-furnace', lambda m: anlagen.electric_furnace(m, 0.0), 0.3),
        ('substation', stufe23.substation2, 0.36),
    ]
    for item, fn, sc in simple:
        eisen.reset(samples=48)
        root = fn(anlagen.Mats())
        if item in ('battery', 'electric-engine-unit', 'plastic-bar'):
            root.rotation_euler = (0, 0, math.radians(30))
        finish(out, f'item.{item}', root, scale=sc, z=-0.05)
    eisen.reset(samples=48)
    finish(out, 'item.chemical-science-pack', anlagen.flask(anlagen.Mats(), (0.1, 0.45, 0.95)), scale=1.2, z=-0.08)
    for fluid, hex_ in FLUIDS.items():
        eisen.reset(samples=48)
        finish(out, f'item.{fluid}', anlagen.fluid_barrel(anlagen.Mats(), eisen.srgb(hex_)), scale=1.25, z=-0.1)
    # Express-Logistik in Blau
    for item, fn, sc in (('express-splitter', lambda m: anlagen.splitter(m, 0.0), 0.42),
                         ('express-underground-belt', lambda m: anlagen.underground(m, False), 0.8)):
        eisen.reset(samples=48)
        m = anlagen.Mats()
        m.paint = anlagen.paint(EXPRESS, 'a_expresspaint')
        finish(out, f'item.{item}', fn(m), scale=sc, z=-0.05)
    eisen.reset(samples=48)
    m = parts.Mats()
    m.ochre = bauten.weathered('eb_paint', EXPRESS, metal=0.3, rough=0.55, rust=0.4, dust=0.45, edge=0.7, streaks=0.5)
    root = belt_piece(m)
    root.rotation_euler = (0, 0, math.radians(35))
    finish(out, 'item.express-transport-belt', root, scale=0.95)
