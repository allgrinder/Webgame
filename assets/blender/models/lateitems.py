"""Item-Symbole des späten Spiels: Module, Zwischenprodukte, Wissenschaftspakete, Gebäude, Roboter."""
import math

import anlagen
import stufe23
import eisen
import spaet
import stufen
import parts

MODULE_COLORS = {'speed': '#3a6fc0', 'productivity': '#c0452e', 'efficiency': '#4a9a3a'}


def finish(out, name, root=None, scale=1.0, z=0.0, rot=0.0):
    if root is not None:
        root.scale = (scale, scale, scale)
        root.location.z += z
        if rot:
            root.rotation_euler = (0, 0, math.radians(rot))
    eisen.camera(1, 1, anchor=(0.5, 0.56))
    out.add(name, 'items', [out.render_frame(name, 0)], (0.5, 0.5))


def module(m, kind, tier):
    """Modul: Platine mit farbigem Kern und Stufenmarken."""
    col = eisen.srgb(MODULE_COLORS[kind])
    core = eisen.material('mod' + kind, col, rough=0.3, metal=0.4)
    glow = eisen.emission_material('modglow' + kind, col, 1.5)
    o = [eisen.box('frame', (0.62, 0.62, 0.08), (0, 0, 0.04), m.steel, bevel=0.03)]
    o.append(eisen.box('core', (0.44, 0.44, 0.06), (0, 0, 0.1), core, bevel=0.03))
    o.append(eisen.box('chip', (0.22, 0.22, 0.04), (0, 0, 0.14), glow, bevel=0.015))
    for k in range(tier):
        o.append(eisen.box(f'pip{k}', (0.06, 0.06, 0.03), (-0.2 + k * 0.1, -0.27, 0.1), m.bright))
    for k in range(6):
        o.append(eisen.box(f'pin{k}', (0.04, 0.08, 0.02), (-0.2 + k * 0.08, 0.33, 0.04), m.copper))
    return eisen.parent_all(o, 'module')


def processing_unit(m):
    board = eisen.material('pu', eisen.srgb('#2a4a8a'), rough=0.45, metal=0.2)
    o = [eisen.box('pcb', (0.72, 0.56, 0.05), (0, 0, 0.03), board, bevel=0.01)]
    o.append(eisen.box('chip', (0.32, 0.32, 0.06), (0, 0, 0.09), m.dark, bevel=0.01))
    o.append(eisen.box('die', (0.14, 0.14, 0.02), (0, 0, 0.13), m.bright))
    for k in range(8):
        o.append(eisen.box(f'tr{k}', (0.6, 0.01, 0.005), (0, -0.24 + k * 0.07, 0.058), m.copper))
    return eisen.parent_all(o, 'pu')


def low_density(m):
    plate = eisen.material('lds', eisen.srgb('#c8b06a'), rough=0.35, metal=0.6)
    o = []
    for k in range(3):
        o.append(eisen.box(f'p{k}', (0.62, 0.5, 0.06), (0, 0, 0.04 + k * 0.12), plate, bevel=0.02))
        for j in range(3):
            o.append(eisen.box(f'h{k}{j}', (0.12, 0.42, 0.02), (-0.2 + j * 0.2, 0, 0.08 + k * 0.12), m.copper))
    return eisen.parent_all(o, 'lds')


def rocket_fuel(m):
    can = eisen.material('rf', eisen.srgb('#c03a2a'), rough=0.4, metal=0.4)
    o = [eisen.cylinder('can', 0.2, 0.55, (0, 0, 0.28), can, segments=24, bevel=0.04)]
    o.append(eisen.cylinder('cap', 0.08, 0.08, (0, 0, 0.6), m.dark, segments=16))
    o.append(eisen.cylinder('band', 0.205, 0.12, (0, 0, 0.3), m.bright, segments=24))
    return eisen.parent_all(o, 'rf')


def robot_frame(m):
    o = [eisen.box('hull', (0.5, 0.4, 0.14), (0, 0, 0.1), m.steel, bevel=0.05)]
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        o.append(eisen.cylinder(f'ring{k}', 0.12, 0.04, (math.cos(a) * 0.3, math.sin(a) * 0.3, 0.12), m.dark, segments=16))
    return eisen.parent_all(o, 'frame')


def concrete(m):
    mat = eisen.material('conc', eisen.srgb('#8f8a80'), rough=0.9, noise=0.3, noise_scale=30)
    o = [eisen.box(f'b{k}', (0.5, 0.5, 0.12), (-0.08 + k * 0.08, -0.06 + k * 0.06, 0.06 + k * 0.12), mat, bevel=0.02) for k in range(3)]
    return eisen.parent_all(o, 'concrete')


def rail(m):
    wood = eisen.material('sleeper', eisen.srgb('#5a4a3a'), rough=0.9)
    o = [eisen.box(f's{k}', (0.7, 0.1, 0.05), (0, -0.3 + k * 0.2, 0.03), wood) for k in range(4)]
    for x in (-0.2, 0.2):
        o.append(eisen.box(f'r{x}', (0.06, 0.8, 0.06), (x, 0, 0.09), m.steel, bevel=0.01))
    return eisen.parent_all(o, 'rail')


def rocket_part(m):
    shell = eisen.material('rp', eisen.srgb('#d8d8d0'), rough=0.3, metal=0.5)
    o = [eisen.cylinder('seg', 0.22, 0.5, (0, 0, 0.25), shell, segments=28, bevel=0.03)]
    for z in (0.08, 0.42):
        o.append(eisen.cylinder(f'ring{z}', 0.225, 0.04, (0, 0, z), m.dark, segments=28))
    return eisen.parent_all(o, 'rp')


def satellite(m):
    o = [eisen.box('bus', (0.3, 0.3, 0.3), (0, 0, 0.25), m.bright, bevel=0.03)]
    cell = eisen.material('satcell', eisen.srgb('#1d2a44'), rough=0.15, metal=0.3)
    for sx in (-1, 1):
        o.append(eisen.box(f'wing{sx}', (0.36, 0.2, 0.02), (sx * 0.36, 0, 0.25), cell))
    o.append(eisen.cylinder('dish', 0.12, 0.03, (0, 0, 0.42), m.steel, segments=20))
    return eisen.parent_all(o, 'sat')


def render(out):
    for kind in ('speed', 'productivity', 'efficiency'):
        for tier in (1, 2, 3):
            eisen.reset(samples=40)
            name = f'item.{kind}-module' + ('' if tier == 1 else f'-{tier}')
            finish(out, name, module(anlagen.Mats(), kind, tier), scale=1.2, rot=20)
    simple = [
        ('processing-unit', processing_unit, 1.1, 20), ('low-density-structure', low_density, 1.1, 25),
        ('rocket-fuel', rocket_fuel, 1.15, 0), ('flying-robot-frame', robot_frame, 1.2, 20),
        ('concrete', concrete, 1.2, 15), ('rail', rail, 1.0, 35), ('rocket-part', rocket_part, 1.15, 0),
        ('satellite', satellite, 1.25, 25),
    ]
    for item, fn, sc, rot in simple:
        eisen.reset(samples=40)
        finish(out, f'item.{item}', fn(anlagen.Mats()), scale=sc, rot=rot)
    for item, color in (('production-science-pack', (0.55, 0.2, 0.75)), ('utility-science-pack', (0.95, 0.8, 0.15)),
                        ('space-science-pack', (0.9, 0.92, 0.95))):
        eisen.reset(samples=40)
        finish(out, f'item.{item}', anlagen.flask(anlagen.Mats(), color), scale=1.2, z=-0.08)
    builds = [
        ('assembling-machine-3', lambda m: stufen.assembler3(m, 0.0), 0.3), ('beacon', lambda m: stufe23.beacon3(m, 0.6), 0.3),
        ('roboport', stufe23.roboport3, 0.22), ('radar', lambda m: spaet.radar(m, 0.1), 0.28),
        ('rocket-silo', spaet.rocket_silo, 0.1), ('cargo-landing-pad', spaet.landing_pad, 0.11),
    ]
    for item, fn, sc in builds:
        eisen.reset(samples=40)
        finish(out, f'item.{item}', fn(anlagen.Mats()), scale=sc, z=-0.05)
    for item, color in spaet.CHESTS.items():
        eisen.reset(samples=40)
        finish(out, f'item.{item}', stufe23.logistic_chest3(anlagen.Mats(), color), scale=0.8, z=-0.05)
    for kind in ('construction', 'logistic'):
        eisen.reset(samples=40)
        root = spaet.robot(anlagen.Mats(), kind)
        root.location.z = 0.25
        finish(out, f'item.{kind}-robot', root, scale=1.6, rot=25)
    parts  # noqa: B018
