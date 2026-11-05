"""Gegner und Verteidigung (lib/kampf.py): Krabbler (16 Richtungen × 4 Laufbilder, Kadaver, Schatten), Nester (2 Varianten,
Ruine), Geschützturm (Sockel + Kopf in 16 Richtungen), Steinmauer, Symbole (Munition, Waffen, Turm, Mauer)."""
import math

import anlagen
import eisen
import kampf

DIRS = 16
WALK = 4


def icon(out, name, root, scale=1.0, z=0.0, rot=0.0):
    root.scale = (scale, scale, scale)
    root.location.z += z
    if rot:
        root.rotation_euler = (0, 0, math.radians(rot))
    eisen.camera(1, 1, anchor=(0.5, 0.56))
    out.add(name, 'items', [out.render_frame(name, 0)], (0.5, 0.5))


def render(out):
    # Krabbler: Richtung k = k/16 Umdrehung im Uhrzeigersinn von Norden
    canvas, anchor = (1.5, 1.5), (0.5, 0.6)
    for k in range(DIRS):
        frames = []
        for f in range(WALK):
            eisen.reset(samples=24)
            root = kampf.krabbler(f / WALK)
            root.rotation_euler = (0, 0, -k / DIRS * math.tau)
            eisen.camera(*canvas, anchor=anchor)
            frames.append(out.render_frame(f'enemy.krabbler.{k}', f))
        out.add(f'enemy.krabbler.{k}', 'entities', frames, anchor, fps=12)
    eisen.reset(samples=24)
    kampf.krabbler(0.0, dead=True)
    eisen.camera(*canvas, anchor=anchor)
    out.add('enemy.krabbler.dead', 'entities', [out.render_frame('enemy.krabbler.dead', 0)], anchor)
    eisen.reset(samples=16)
    kampf.krabbler(0.0)
    eisen.shadow_render(out, 'enemy.krabbler.shadow', 'entities', (1.5, 1.5), (0.45, 0.45))
    # Nester
    ncanvas, nanchor = (6.5, 7.0), (0.5, 3.9 / 7.0)
    for v in range(2):
        eisen.reset(samples=36)
        kampf.nest(v)
        eisen.camera(*ncanvas, anchor=nanchor)
        out.add(f'enemy.nest.{v}', 'entities', [out.render_frame(f'enemy.nest.{v}', 0)], nanchor)
    eisen.reset(samples=32)
    kampf.nest(0, ruin=True)
    eisen.camera(*ncanvas, anchor=nanchor)
    out.add('enemy.nest.ruin', 'entities', [out.render_frame('enemy.nest.ruin', 0)], nanchor)
    eisen.reset(samples=24)
    kampf.nest(0)
    eisen.shadow_render(out, 'enemy.nest.shadow', 'entities', (7.0, 7.0), (3.0 / 7.0, 3.0 / 7.0), half=True)
    # Geschützturm: Sockel, Kopf in 16 Richtungen, Schatten
    anlagen.building(out, 'gun-turret.base', lambda m, ph: kampf.turret_base(m), (2.5, 3.0), (0.5, 1.8 / 3.0),
                     (3.5, 3.5), (1.25 / 3.5, 1.25 / 3.5), frames=1, samples=36)
    hcanvas, hanchor = (3.25, 3.5), (0.5, 1.9 / 3.5)
    frames = []
    for k in range(DIRS):
        eisen.reset(samples=28)
        root = kampf.turret_head()
        root.rotation_euler = (0, 0, -k / DIRS * math.tau)
        eisen.camera(*hcanvas, anchor=hanchor)
        frames.append(out.render_frame('gun-turret.head', k))
    out.add('gun-turret.head', 'entities', frames, hanchor, meta={'angles': DIRS})
    # Mauer
    anlagen.building(out, 'stone-wall', lambda m, ph: kampf.wall(m), (1.25, 2.0), (0.5, 1.4 / 2.0),
                     (2.0, 2.0), (0.5 / 2.0, 0.5 / 2.0), frames=1, samples=36)
    # Symbole
    eisen.reset(samples=40)
    icon(out, 'item.firearm-magazine', kampf.magazine(False), 1.1, rot=20)
    eisen.reset(samples=40)
    icon(out, 'item.piercing-rounds-magazine', kampf.magazine(True), 1.1, rot=20)
    eisen.reset(samples=40)
    icon(out, 'item.pistol', kampf.gun(False), 1.2, rot=-25)
    eisen.reset(samples=40)
    icon(out, 'item.submachine-gun', kampf.gun(True), 0.85, rot=-25)
    eisen.reset(samples=40)
    b = kampf.turret_base()
    h = kampf.turret_head()
    h.parent = b
    icon(out, 'item.gun-turret', b, 0.38, z=-0.05, rot=30)
    eisen.reset(samples=40)
    icon(out, 'item.stone-wall', kampf.wall(), 0.75, z=-0.05, rot=20)
