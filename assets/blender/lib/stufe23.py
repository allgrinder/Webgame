"""Stufe 2 (Werkstatt) und 3 (Hochtechnik) für bestehende Modelle: Originalform aus anlagen/spaet plus
Baukasten-Details (Geländer, Leitern, Bühnen, Rohrbrücken, Schaltschränke, Leuchtstreifen), docs/ART_STYLE.md.
Anschlüsse und Größen bleiben unverändert. Signatur wie die Originale: fn(m, phase|fire|...)."""
import math

import anlagen
import bauten
import eisen
import kit
import spaet
from bauten import beam


def _attach(root, objs):
    for ob in objs:
        ob.parent = root
    return root


def _ring(cx, cy, r, z, n=16):
    return [(cx + math.cos(k / n * math.tau) * r, cy + math.sin(k / n * math.tau) * r, z) for k in range(n)]


def _cabinet(o, t, x, y, z=0.14, leds=('#6cff7a', '#ffb347'), w=0.32, d=0.22, h=0.5, name='cab'):
    """Schaltschrank mit Tür, LEDs zur Kamera (Süd)."""
    o.append(eisen.box(name, (w, d, h), (x, y, z + h / 2), t.accent, bevel=0.015))
    o.append(eisen.box(name + 'roof', (w + 0.04, d + 0.04, 0.03), (x, y, z + h + 0.015), t.frame))
    o.append(eisen.box(name + 'door', (w - 0.06, 0.01, h - 0.12), (x, y - d / 2 - 0.004, z + h / 2), t.frame))
    for k, c in enumerate(leds):
        o.append(eisen.cylinder(f'{name}led{k}', 0.014, 0.015, (x - w / 4 + k * 0.07, y - d / 2 - 0.012, z + h - 0.09),
                                kit.glow(f'{name}l{k}{c}', c, 4.0), segments=8, rot=(math.pi / 2, 0, 0)))


# --------------------------------------------------------------------------- Stufe 2

def storage_tank2(m):
    t = kit.Tier(2, accent='#5b6650', prefix='tk')
    m.steel = bauten.weathered('tkshell', '#5f665a', metal=0.45, rough=0.5, rust=0.3, dust=0.25, edge=0.55, streaks=0.5)
    m.paint = bauten.weathered('tkdome', '#7d8073', metal=0.4, rough=0.45, rust=0.2, dust=0.3, edge=0.5, streaks=0.3)
    root = anlagen.storage_tank(m)
    o = []
    # Nietreihen an den Schüssen
    for z in (0.58, 1.02):
        for k in range(40):
            b = k / 40 * math.tau
            if math.sin(b) > 0.3:
                continue
            o.append(eisen.cylinder(f'rv{z}{k}', 0.013, 0.02, (math.cos(b) * 1.262, math.sin(b) * 1.262, z), t.metal, segments=6,
                                    rot=(math.pi / 2, 0, b + math.pi / 2)))
    # Geländer am Kuppelrand, Laufsteg zur Luke, Warnring am Fuß, Füllstandsanzeige
    kit.railing(o, _ring(0, 0, 1.18, 1.52, 24), 0.2, t.hazard, post_every=0.5, closed=True)
    o.append(beam('walk', (0.55, -1.15, 1.6), (0.3, -0.25, 1.9), (0.22, 0.03), t.frame))
    o.append(eisen.cylinder('hazring', 1.3, 0.06, (0, 0, 0.13), t.hazard, segments=48))
    o.append(eisen.box('gauge', (0.08, 0.04, 1.0), (-0.45, -1.24, 0.75), t.frame, bevel=0.005))
    o.append(eisen.box('gaugeglass', (0.04, 0.01, 0.9), (-0.45, -1.265, 0.75), kit.glow('tkg', '#3a6a40', 1.2)))
    o.append(eisen.box('gaugelevel', (0.04, 0.012, 0.5), (-0.45, -1.268, 0.5), kit.glow('tkgl', '#6aa860', 2.0)))
    kit.beacon_light(o, 'warn', (0.3, -0.2, 1.97), kit.glow('tkwarn', '#ff5a3a', 4.0), t)
    return _attach(root, o)


def chemical_plant2(m, phase=0.0):
    t = kit.Tier(2, accent='#4d6a5a', prefix='ch')
    m.copper = bauten.weathered('chvessel', '#6f7a68', metal=0.5, rough=0.45, rust=0.25, dust=0.2, edge=0.55, streaks=0.4)
    m.green = t.accent
    root = anlagen.chemical_plant(m, phase)
    o = []
    kit.railing(o, _ring(0, 0, 0.84, 1.33, 20), 0.18, t.hazard, post_every=0.4, closed=True)
    kit.ladder(o, 'lad', 0.0, -0.9, 0.14, 1.3, t.metal)
    _cabinet(o, t, 1.05, 0.15, name='chcab')
    for k, (x, y) in enumerate(((-0.95, -0.85), (0.95, -0.85))):
        kit.pipe_run(o, f'link{k}', [(x, y + 0.3, 0.8), (x * 0.55, y + 0.45, 0.8)], 0.035, t.metal, t.frame)
        o.append(eisen.cylinder(f'drumcap{k}', 0.33, 0.04, (x, y, 0.96), t.frame, segments=20))
    kit.grille(o, 'gr', 0.5, 0.3, (-1.0, 0.55, 0.14), t.frame, t.metal)
    o.append(eisen.box('hazS', (2.6, 0.05, 0.02), (0, -1.36, 0.15), t.hazard))
    kit.beacon_light(o, 'warn', (0.0, 0.0, 1.63), kit.glow('chwarn', '#ffa53a', 4.0), t)
    return _attach(root, o)


def oil_refinery2(m, phase=0.0):
    t = kit.Tier(2, accent='#6a5a3a', prefix='rf')
    m.steel = bauten.weathered('rfcol', '#5c5f5a', metal=0.55, rough=0.45, rust=0.3, dust=0.2, edge=0.55, streaks=0.5)
    m.green = bauten.weathered('rftank', '#56604e', metal=0.4, rough=0.5, rust=0.3, dust=0.2, edge=0.55, streaks=0.4)
    m.paint = t.accent
    root = anlagen.oil_refinery(m, phase)
    o = []
    cols = ((-1.2, 0.15, 0.45, 3.2), (0.0, 0.3, 0.38, 2.6), (1.25, 0.05, 0.5, 2.9))
    for k, (x, y, r, h) in enumerate(cols):
        # Ringbühne mit Geländer und Leiter je Kolonne
        zb = min(h - 0.3, 1.8)
        plat = eisen.cylinder(f'plat{k}', r + 0.2, 0.04, (x, y, zb), t.frame, segments=28)
        cut = eisen.cylinder(f'platc{k}', r + 0.02, 0.2, (x, y, zb), t.frame, segments=28)
        mod = plat.modifiers.new('hole', 'BOOLEAN')
        mod.object = cut
        mod.operation = 'DIFFERENCE'
        cut.hide_render = True
        o.append(plat)
        kit.railing(o, _ring(x, y, r + 0.18, zb + 0.02, 18), 0.18, t.hazard, post_every=0.35, closed=True)
        kit.ladder(o, f'lad{k}', x, y - r - 0.06, 0.14, zb, t.metal)
        o.append(eisen.cylinder(f'top{k}', r * 0.3, 0.12, (x, y, h + 0.4), t.metal, segments=12))
    # Rohrbrücke zwischen den Kolonnen
    for z in (1.0, 1.15):
        o.append(bauten.pipe(f'rack{z}', (-1.2, 0.75, z), (1.25, 0.75, z), 0.05, t.metal, 12))
    for x in (-1.6, -0.6, 0.6, 1.6):
        o.append(beam(f'rackpost{x}', (x, 0.75, 0.14), (x, 0.75, 1.22), (0.06, 0.06), t.frame))
    o.append(beam('rackbeam', (-1.7, 0.75, 1.22), (1.7, 0.75, 1.22), (0.08, 0.05), t.frame))
    _cabinet(o, t, 1.9, -1.9, h=0.6, name='rfcab')
    kit.grille(o, 'gr', 0.7, 0.4, (0, -1.3, 1.04), t.frame, t.metal)
    o.append(eisen.box('hazS', (4.6, 0.06, 0.02), (0, -2.37, 0.15), t.hazard))
    kit.beacon_light(o, 'warn', (-1.2, 0.15, 3.55), kit.glow('rfwarn', '#ff5a3a', 5.0), t)
    return _attach(root, o)


def steel_furnace2(m, fire=0.0):
    t = kit.Tier(2, accent='#5a5048', prefix='sf')
    m.steel = bauten.weathered('sfbody', '#55524c', metal=0.6, rough=0.5, rust=0.35, dust=0.2, edge=0.6, streaks=0.5)
    root = anlagen.steel_furnace(m, fire)
    o = []
    kit.pipe_run(o, 'duct', [(-0.9, -0.5, 0.2), (-0.9, -0.5, 0.85), (-0.9, 0.6, 0.85)], 0.05, t.metal, t.frame)
    _cabinet(o, t, 0.75, -0.92, z=0.12, h=0.3, w=0.22, d=0.12, leds=('#ffb347',), name='sfcab')
    kit.grille(o, 'gr', 0.5, 0.3, (-0.4, 0.3, 1.18), t.frame, t.metal)
    for z in (1.2, 1.55):
        o.append(eisen.cylinder(f'stband{z}', 0.175, 0.04, (0.45, 0.4, z), t.frame, segments=20))
    o.append(eisen.box('hazS', (1.8, 0.04, 0.02), (0, -0.96, 0.13), t.hazard))
    return _attach(root, o)


def pumpjack2(m, phase=0.0):
    t = kit.Tier(2, accent='#6a5a3a', prefix='pj')
    root = anlagen.pumpjack(m, phase)
    o = []
    _cabinet(o, t, -1.1, -1.1, h=0.45, name='pjcab')
    kit.railing(o, [(-1.35, -1.35, 0.14), (1.35, -1.35, 0.14), (1.35, 1.35, 0.14)], 0.25, t.hazard, post_every=0.6)
    kit.cable(o, 'cab', [(-1.1, -1.0, 0.5), (-0.6, -0.6, 0.35), (-0.2, -0.2, 0.4)], 0.02, t.rubber)
    return _attach(root, o)


def substation2(m):
    t = kit.Tier(2, accent='#5a6068', prefix='ss')
    root = anlagen.substation(m)
    o = []
    o.append(eisen.box('haz', (1.8, 0.04, 0.02), (0, -0.92, 0.12), t.hazard))
    kit.beacon_light(o, 'warn', (0.6, -0.6, 0.6), kit.glow('sswarn', '#ffb347', 3.0), t)
    return _attach(root, o)


# --------------------------------------------------------------------------- Stufe 3

def roboport3(m):
    t = kit.Tier(3, accent='#2f6f68', prefix='rp')
    cyan = kit.glow('rpcyan', '#5ef2e0', 5.0)
    root = spaet.roboport(m)
    o = []
    # Leuchtstreifen an den Gehäusekanten, Dachluke mit Warnrahmen, Paneelfugen, Schüssel-Antenne
    for s in (-1, 1):
        kit.light_strip(o, f'lsx{s}', (-1.2, s * 1.31, 0.3), (1.2, s * 1.31, 0.3), cyan, (0.02, 0.015))
        kit.light_strip(o, f'lsy{s}', (s * 1.31, -1.2, 0.3), (s * 1.31, 1.2, 0.3), cyan, (0.02, 0.015))
    o.append(eisen.box('hatchframe', (1.16, 1.16, 0.04), (0, 0, 1.37), t.hazard, bevel=0.01))
    for k in range(4):
        b = k * math.pi / 2
        o.append(eisen.box(f'vent{k}', (0.5, 0.2, 0.05), (math.cos(b) * 0.85, math.sin(b) * 0.85, 1.38), t.frame, bevel=0.01, rot=(0, 0, b + math.pi / 2)))
    o.append(eisen.cylinder('dish', 0.22, 0.05, (-0.75, 0.75, 1.55), t.metal, segments=24, bevel=0.02, rot=(0.5, -0.4, 0)))
    o.append(eisen.cylinder('dishpost', 0.03, 0.2, (-0.75, 0.75, 1.42), t.frame, segments=8))
    for sx in (-1, 1):
        for sy in (-1, 1):
            ring = eisen.cylinder(f'padring{sx}{sy}', 0.3, 0.012, (sx * 1.45, sy * 1.45, 0.945), kit.glow('rpring', '#5ef2e0', 2.5), segments=32)
            cut = eisen.cylinder(f'padcut{sx}{sy}', 0.26, 0.1, (sx * 1.45, sy * 1.45, 0.945), cyan, segments=32)
            mod = ring.modifiers.new('hole', 'BOOLEAN')
            mod.object = cut
            mod.operation = 'DIFFERENCE'
            cut.hide_render = True
            o.append(ring)
    return _attach(root, o)


def beacon3(m, lv=0.0):
    t = kit.Tier(3, accent='#2f6f68', prefix='bc')
    root = spaet.beacon(m, lv)
    o = []
    cyan = kit.glow('bccyan', '#5ef2e0', 2.0 + 4.0 * lv)
    for s in (-1, 1):
        kit.light_strip(o, f'bx{s}', (-0.9, s * 1.005, 0.3), (0.9, s * 1.005, 0.3), cyan, (0.02, 0.012))
        kit.light_strip(o, f'by{s}', (s * 1.005, -0.9, 0.3), (s * 1.005, 0.9, 0.3), cyan, (0.02, 0.012))
    for k in range(8):
        b = k / 8 * math.tau
        o.append(eisen.box(f'fin{k}', (0.3, 0.02, 0.12), (math.cos(b) * 0.32, math.sin(b) * 0.32, 0.8), t.metal, rot=(0, 0, b)))
    return _attach(root, o)


def logistic_chest3(m, color):
    t = kit.Tier(3, accent='#2f6f68', prefix='lc')
    root = spaet.logistic_chest(m, color)
    o = [eisen.box('lcstrip', (0.6, 0.01, 0.03), (0, -0.41, 0.15), kit.glow('lcg', '#5ef2e0', 2.5))]
    return _attach(root, o)
