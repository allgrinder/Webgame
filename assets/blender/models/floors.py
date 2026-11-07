"""Bodenbeläge (1×1-Kacheln, je 4 Varianten): Steinpflaster, Beton, Gefahrenbeton, veredelter Beton,
veredelter Gefahrenbeton. Flach, von oben mit der Spielkamera (die Kachel füllt genau 128×128 px).
Gefahrenstreifen laufen über die Feldgrenzen weiter (Periode teilt die Feldbreite)."""
import math
import random

import bauten
import eisen
import gw_ground
import kit

lin = gw_ground.lin
VARIANTS = 4


def slab_plane(name, mat, size=1.06, h=0.02):
    """Grundplatte etwas größer als das Feld (keine Kantenblendung)."""
    return eisen.box(name, (size, size, h), (0, 0, -h / 2), mat)


def stone_path(v):
    rnd = random.Random(10 + v)
    o = []
    mortar = gw_ground.pmat('fl_mortar', lin('#4a4237'), 0.95, 0.3, 0.6, 30)
    tones = [gw_ground.pmat(f'fl_st{i}', lin(c), 0.9, 0.35, 0.7, 14 + i) for i, c in
             enumerate(('#857a69', '#786d5d', '#8f8472', '#6f6556', '#7f7461'))]
    o.append(slab_plane('base', mortar))
    # Reihen versetzter Pflastersteine (3 Reihen je Feld, durchgehend über die Felder)
    for r in range(3):
        y0 = -0.5 + r / 3
        off = (r % 2) * 0.25
        x = -0.5 - off
        while x < 0.5:
            w = rnd.choice((0.3, 0.36, 0.42, 0.5))
            x1 = min(x + w, 0.5 + 0.2)
            cx = (x + x1) / 2
            cw = x1 - x - 0.035
            if cx + cw / 2 > -0.53 and cx - cw / 2 < 0.53:
                o.append(eisen.box(f's{r}{x:.2f}', (cw, 1 / 3 - 0.035, 0.035 + rnd.uniform(0, 0.012)),
                                   (cx, y0 + 1 / 6, 0.017), rnd.choice(tones), bevel=0.012,
                                   rot=(rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02), rnd.uniform(-0.03, 0.03))))
            x = x1
    return eisen.parent_all(o, 'stonepath')


def concrete(v, hazard=False, refined=False):
    rnd = random.Random(30 + v + (100 if refined else 0))
    o = []
    if refined:
        mat = bauten.weathered('fl_ref', '#55595d', metal=0.15, rough=0.35, rust=0.0, dust=0.1, edge=0.1, grime=0.2, streaks=0.0)
    else:
        mat = gw_ground.pmat('fl_conc', lin('#7d7a72'), 0.92, 0.28, 0.45, 18 + v)
    if hazard:
        mat = kit.hazard('fl_haz', a='#b8902e' if not refined else '#c49a30', b='#232220', scale=4.0, wear=0.6 if not refined else 0.2)
    o.append(slab_plane('base', mat))
    joint = eisen.material('fl_joint', (0.02, 0.02, 0.018), rough=0.9)
    # Fugen an den Feldrändern (halb in jedem Feld) und beim veredelten Beton ein feineres Raster
    w = 0.012 if refined else 0.018
    for s in (-1, 1):
        o.append(eisen.box(f'jx{s}', (1.06, w, 0.006), (0, s * 0.5, 0.001), joint))
        o.append(eisen.box(f'jy{s}', (w, 1.06, 0.006), (s * 0.5, 0, 0.001), joint))
    if refined:
        o.append(eisen.box('jmx', (1.06, 0.006, 0.004), (0, 0, 0.001), joint))
        o.append(eisen.box('jmy', (0.006, 1.06, 0.004), (0, 0, 0.001), joint))
    elif not hazard:
        # Flecken und feine Risse
        stain = eisen.material('fl_stain', eisen.srgb('#74716a'), rough=0.95)
        for i in range(rnd.randint(1, 3)):
            o.append(eisen.cylinder(f'stain{i}', rnd.uniform(0.04, 0.09), 0.002, (rnd.uniform(-0.35, 0.35), rnd.uniform(-0.35, 0.35), 0.001),
                                    stain, segments=12))
        if v % 2 == 0:
            x, y = rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3)
            for k in range(4):
                a = rnd.uniform(0, math.tau)
                l = rnd.uniform(0.08, 0.18)
                o.append(eisen.box(f'crack{k}', (l, 0.006, 0.004), (x + math.cos(a) * l / 2, y + math.sin(a) * l / 2, 0.001), joint, rot=(0, 0, a)))
                x += math.cos(a) * l
                y += math.sin(a) * l
    return eisen.parent_all(o, 'concrete')


KINDS = (
    ('floor.stone', lambda v: stone_path(v)),
    ('floor.concrete', lambda v: concrete(v)),
    ('floor.hazard', lambda v: concrete(v, hazard=True)),
    ('floor.refined', lambda v: concrete(v, refined=True)),
    ('floor.refined-hazard', lambda v: concrete(v, hazard=True, refined=True)),
)


def render(out):
    for prefix, fn in KINDS:
        for v in range(VARIANTS):
            eisen.reset(samples=32, ground=False)
            fn(v)
            eisen.camera(1.0, 1.0)
            name = f'{prefix}.{v}'
            out.add(name, 'decals', [out.render_frame(name, 0)], (0.5, 0.5))
    render_icons(out)


def icon(name, mat_fn):
    """Symbol: zwei gestapelte Platten."""
    o = []
    for k in range(2):
        o.append(eisen.box(f'p{k}', (0.62, 0.62, 0.1), (0.04 * k, 0.03 * k, 0.05 + k * 0.11), mat_fn(), bevel=0.02,
                           rot=(0, 0, math.radians(-8 + k * 14))))
    root = eisen.parent_all(o, name)
    root.rotation_euler = (math.radians(-15), 0, math.radians(20))
    eisen.camera(1, 1, anchor=(0.5, 0.56))
    return root


def render_icons(out):
    mats = (
        ('item.hazard-concrete', lambda: kit.hazard('ic_haz', a='#b8902e', b='#232220', scale=6.0, wear=0.5)),
        ('item.refined-concrete', lambda: bauten.weathered('ic_ref', '#55595d', metal=0.15, rough=0.35, rust=0.0, dust=0.1, edge=0.2, grime=0.2, streaks=0.0)),
        ('item.refined-hazard-concrete', lambda: kit.hazard('ic_rhaz', a='#c49a30', b='#232220', scale=6.0, wear=0.2)),
    )
    for name, fn in mats:
        eisen.reset(samples=48)
        cache = {}
        icon(name, lambda: cache.setdefault('m', fn()))
        out.add(name, 'items', [out.render_frame(name, 0)], (0.5, 0.5))
