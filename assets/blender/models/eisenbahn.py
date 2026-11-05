"""Eisenbahn und Schaltungsnetz: Gleise, Lokomotive und Güterwagen in 16 Winkeln (mit Schatten), Bahnhof,
Kombinatoren, Item-Symbole. Geometrie in lib/bahn.py."""
import math

import anlagen
import bahn
import eisen

ALL = (0, 1, 2, 3)


def icon(out, name, root, scale, rot=0.0):
    root.scale = (scale, scale, scale)
    root.location.z -= 0.05
    if rot:
        root.rotation_euler = (0, 0, math.radians(rot))
    eisen.camera(1, 1, anchor=(0.5, 0.56))
    out.add(name, 'items', [out.render_frame(name, 0)], (0.5, 0.5))


def render(out):
    for d in (0, 1):
        eisen.reset(samples=32)
        root = bahn.straight_rail(anlagen.Mats())
        eisen.rotate_root(root, d)
        eisen.camera(2.25, 2.25)
        name = f'rail.straight.{d}'
        out.add(name, 'entities', [out.render_frame(name, 0)], (0.5, 0.5))
    for d in ALL:
        eisen.reset(samples=32)
        root = bahn.curved_rail(anlagen.Mats())
        eisen.rotate_root(root, d)
        eisen.camera(4.25, 4.25)
        name = f'rail.curve.{d}'
        out.add(name, 'entities', [out.render_frame(name, 0)], (0.5, 0.5))
    for kind, fn in (('locomotive', bahn.locomotive), ('cargo-wagon', bahn.cargo_wagon)):
        for k in range(16):
            name = f'{kind}.{k}'
            eisen.reset(samples=32)
            root = fn(anlagen.Mats())
            root.rotation_euler = (0, 0, -k * math.pi / 8)
            eisen.camera(7.0, 7.5, anchor=(0.5, 4.0 / 7.5))
            out.add(name, 'entities', [out.render_frame(name, 0)], (0.5, 4.0 / 7.5))
            eisen.reset(samples=24)
            root = fn(anlagen.Mats())
            root.rotation_euler = (0, 0, -k * math.pi / 8)
            eisen.shadow_render(out, f'{name}.shadow', 'entities', (8.0, 8.0), (0.45, 0.45), half=True)
    anlagen.building(out, 'train-stop', lambda m, ph: bahn.train_stop(m), (2.5, 3.75), (0.5, 2.4 / 3.75),
                     (3.5, 3.5), (1.25 / 3.5, 1.25 / 3.5), dirs=ALL, frames=1, samples=36)
    anlagen.building(out, 'constant-combinator', lambda m, ph: bahn.combinator(m, 'constant'), (1.25, 1.5), (0.5, 0.8 / 1.5),
                     (1.75, 1.75), (0.6 / 1.75, 0.6 / 1.75), dirs=ALL, frames=1, samples=32)
    for mode in ('arithmetic', 'decider'):
        anlagen.building(out, f'{mode}-combinator', lambda m, ph, md=mode: bahn.combinator(m, md), (2.25, 2.5), (0.5, 1.3 / 2.5),
                         (2.75, 2.75), (1.0 / 2.75, 1.0 / 2.75), dirs=ALL, frames=1, samples=32)
    # Symbole
    for item, fn, sc, rot in (('locomotive', bahn.locomotive, 0.15, 40), ('cargo-wagon', bahn.cargo_wagon, 0.15, 40),
                              ('train-stop', bahn.train_stop, 0.4, 20)):
        eisen.reset(samples=40)
        icon(out, f'item.{item}', fn(anlagen.Mats()), sc, rot)
    for mode in ('constant', 'arithmetic', 'decider'):
        eisen.reset(samples=40)
        icon(out, f'item.{mode}-combinator', bahn.combinator(anlagen.Mats(), mode), 0.75 if mode == 'constant' else 0.55, 30)
