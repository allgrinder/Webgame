"""Montagemaschinen in drei Ausbaustufen (Pilot des Stils „Endzeit-Industrie“, docs/ART_STYLE.md).

Stufe 1: aus Schrott zusammengeschweißt. Stufe 2: genormte Werkstatt-Bauweise. Stufe 3: Hochtechnik.
Alle 3×3, Ausgabe nach Norden (+Y), mittig um den Ursprung.
"""
import math

import bauten
import eisen
import kit
from bauten import beam


# --------------------------------------------------------------------------- Stufe 1: Notbau

def assembler1(_m, phase=0.0):
    t = kit.Tier(1, accent='#7a6a3a', prefix='am1')
    rnd = kit.rng(101)
    o = []
    H = 1.02
    # Fundament: Träger-Rahmen, darunter Holzbohlen
    for k in range(6):
        y = -1.25 + k * 0.5
        kit.plate(o, f'plank{k}', (2.95, 0.42, 0.06), (rnd.uniform(-0.03, 0.03), y, 0.03), t.wood, rot=(0, 0, rnd.uniform(-0.02, 0.02)))
    for s in (-1, 1):
        kit.ibeam(o, f'sill{s}', (-1.42, s * 1.32, 0.13), (1.42, s * 1.32, 0.13), 0.12, 0.12, t.frame)
        kit.ibeam(o, f'sillx{s}', (s * 1.32, -1.3, 0.13), (s * 1.32, 1.3, 0.13), 0.12, 0.12, t.frame)
    # Eckstützen aus Winkelstahl
    for sx in (-1, 1):
        for sy in (-1, 1):
            kit.plate(o, f'post{sx}{sy}a', (0.16, 0.04, H), (sx * 1.3, sy * 1.36, 0.19 + H / 2), t.frame)
            kit.plate(o, f'post{sx}{sy}b', (0.04, 0.16, H), (sx * 1.36, sy * 1.3, 0.19 + H / 2), t.frame)
    # Wände aus Flickenblechen (Süden mit offener Werköffnung)
    pan = t.panels
    kit.wall_panels(o, 'X', 1.3, -1.25, 1.25, 0.2, H + 0.15, 5, pan, rnd, jitter=0.6)
    kit.wall_panels(o, 'Y', -1.3, -1.25, 1.25, 0.2, H + 0.15, 5, pan, rnd, jitter=0.6, outward=-1)
    kit.wall_panels(o, 'Y', 1.3, -1.25, 1.25, 0.2, H + 0.15, 5, pan, rnd, jitter=0.6)
    kit.wall_panels(o, 'X', -1.3, -1.25, 1.25, 0.2, 0.55, 4, pan, rnd, jitter=0.6, outward=-1)
    kit.wall_panels(o, 'X', -1.3, -1.25, 1.25, H - 0.05, H + 0.15, 4, pan, rnd, jitter=0.6, outward=-1)
    o.append(eisen.box('slotin', (2.4, 0.04, H - 0.62), (0, -1.27, 0.55 + (H - 0.6) / 2), t.inner))
    # Werköffnung: Gitter aus Bewehrungsstahl
    for k in range(9):
        x = -1.05 + k * 0.26
        o.append(bauten.pipe(f'bar{k}', (x, -1.34, 0.56), (x + rnd.uniform(-0.03, 0.03), -1.34, H - 0.04), 0.012, t.metal, 6))
    kit.ibeam(o, 'lintel', (-1.3, -1.36, H - 0.02), (1.3, -1.36, H - 0.02), 0.08, 0.06, t.frame)
    # Flicken und Schweißpunkte auf den Wänden (Kamera sieht Süd und Dach)
    for k in range(5):
        x = rnd.uniform(-1.1, 1.1)
        p = kit.plate(o, f'wpatch{k}', (rnd.uniform(0.18, 0.35), 0.015, rnd.uniform(0.12, 0.25)), (x, -1.345, rnd.uniform(0.28, 0.45)),
                      pan[rnd.randrange(len(pan))], rot=(0, rnd.uniform(-0.3, 0.3), 0))
    # Dach: Flickenblech, Wellblech und Plane
    Z = H + 0.15
    kit.plate(o, 'roofbase', (2.75, 2.75, 0.04), (0, 0, Z + 0.02), t.frame)
    kit.paneled_top(o, -1.38, -1.38, 0.05, 1.38, Z + 0.04, 2, 4, pan, rnd, gap=0.025, thick=0.03, jitter=0.03, bolts_mat=t.metal)
    o.append(kit.corrugated('corr', 1.25, 1.3, 9, 0.03, (0.72, 0.68, Z + 0.08), t.corr, rot=(0.04, -0.05, 0.03), axis='X'))
    # Plane über der Südostecke, mit Seilen festgezurrt
    tarp = kit.corrugated('tarp', 1.3, 1.0, 2.5, 0.04, (0.72, -0.82, Z + 0.32), t.tarp, rot=(-0.18, 0.03, -0.04), axis='Y')
    o.append(tarp)
    for k, (x, y) in enumerate(((0.12, -1.28), (1.3, -1.28), (0.12, -0.36), (1.3, -0.36))):
        o.append(eisen.cylinder(f'tpole{k}', 0.025, 0.4, (x, y, Z + 0.15), t.wood, segments=6))
    kit.plate(o, 'crate', (0.36, 0.36, 0.26), (0.45, -0.8, Z + 0.17), t.wood, rot=(0, 0, 0.3))
    o.append(eisen.cylinder('barrel', 0.13, 0.3, (0.95, -0.95, Z + 0.19), t.panels[1], segments=18))
    o.append(eisen.cylinder('barreltop', 0.12, 0.01, (0.95, -0.95, Z + 0.345), t.dark, segments=18))
    for k, (x, y) in enumerate(((0.1, -1.3), (1.35, -1.3), (1.35, -0.33))):
        kit.cable(o, f'rope{k}', [(x, y, Z + 0.1), (x * 1.04, y * 1.04, Z - 0.25)], 0.008, t.wood)
    # Offener Schacht mit drehender Kurbelwelle und Zahnrad (Arbeitsanimation)
    o.append(eisen.box('shaft', (0.95, 0.95, 0.06), (-0.62, 0.55, Z + 0.07), t.inner))
    for s in (-1, 1):
        kit.plate(o, f'shaftr{s}', (1.05, 0.06, 0.12), (-0.62, 0.55 + s * 0.5, Z + 0.1), t.frame)
        kit.plate(o, f'shaftc{s}', (0.06, 1.05, 0.12), (-0.62 + s * 0.5, 0.55, Z + 0.1), t.frame)
    a = phase * math.tau
    g = bauten.gear('gear1', 0.34, 0.28, 12, 0.05, t.metal)
    g.location = (-0.62, 0.55, Z + 0.05)
    g.rotation_euler = (0, 0, a / 3)
    o.append(g)
    o.append(eisen.cylinder('ghub', 0.07, 0.1, (-0.62, 0.55, Z + 0.09), t.dark, segments=12))
    cx, cy = -0.62 + math.cos(a / 3) * 0.2, 0.55 + math.sin(a / 3) * 0.2
    o.append(eisen.cylinder('crankpin', 0.03, 0.08, (cx, cy, Z + 0.12), t.metal, segments=8))
    o.append(beam('conrod', (cx, cy, Z + 0.15), (-0.1, 0.2, Z + 0.15), (0.04, 0.03), t.accent))
    # Abgasrohr mit Ruß, Werkzeugkiste, Kabel zum Mast
    o.append(eisen.cylinder('exh', 0.075, 0.95, (1.15, 1.12, Z + 0.5), t.metal, segments=14))
    o.append(eisen.cylinder('exhcap', 0.1, 0.04, (1.15, 1.12, Z + 0.98), t.dark, segments=14))
    o.append(eisen.cylinder('exhsoot', 0.06, 0.01, (1.15, 1.12, Z + 1.0), eisen.material('am1soot', (0.01, 0.01, 0.01), rough=1)))
    kit.plate(o, 'toolbox', (0.32, 0.18, 0.14), (-1.05, -0.6, Z + 0.12), t.accent, rot=(0, 0, 0.2))
    kit.cable(o, 'cable', [(-1.2, 1.2, Z + 0.1), (-1.38, 1.38, Z - 0.1), (-1.45, 1.45, 0.3)], 0.016, t.rubber)
    kit.greebles(o, rnd, -1.2, -1.2, -0.1, -0.2, Z + 0.07, 6, t, hmax=0.08)
    # Verblasster Warnstreifen am Sockel vorn, Arbeitslampe (glimmt)
    kit.plate(o, 'hazard', (2.6, 0.02, 0.07), (0, -1.43, 0.14), t.hazard, bevel=0.0)
    kit.beacon_light(o, 'lamp', (-1.25, -1.25, Z + 0.06), kit.glow('am1lamp', '#ffb347', 3.0), t)
    return eisen.parent_all(o, 'assembler1')


# --------------------------------------------------------------------------- Stufe 2: Werkstatt

def assembler2(_m, phase=0.0):
    t = kit.Tier(2, accent='#3d5263', prefix='am2')
    rnd = kit.rng(202)
    o = []
    # Unterbau: Stahldeck mit Warnkante, darauf versetzt die Halle; frei bleibende Deckstreifen tragen Technik
    kit.plate(o, 'pad', (2.94, 2.94, 0.12), (0, 0, 0.06), t.frame, bevel=0.02)
    kit.paneled_top(o, -1.45, -1.45, 1.45, 1.45, 0.12, 6, 6, [t.accent], rnd, gap=0.014, thick=0.025)
    kit.plate(o, 'hazS', (2.86, 0.06, 0.03), (0, -1.43, 0.16), t.hazard, bevel=0.0)
    kit.plate(o, 'hazE', (0.06, 2.86, 0.03), (1.43, 0, 0.16), t.hazard, bevel=0.0)
    x0, x1, y0, y1 = -1.38, 0.95, -0.95, 1.38
    H = 1.0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for sx, sy in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        kit.plate(o, f'col{sx}{sy}', (0.16, 0.16, H), (sx, sy, 0.15 + H / 2), t.frame, bevel=0.012)
    pan = [t.panels[0]]
    kit.wall_panels(o, 'Y', x1, y0 + 0.08, y1 - 0.08, 0.16, H + 0.1, 4, pan, rnd, ribs_mat=t.frame)
    kit.wall_panels(o, 'Y', x0, y0 + 0.08, y1 - 0.08, 0.16, H + 0.1, 4, pan, rnd, ribs_mat=t.frame, outward=-1)
    kit.wall_panels(o, 'X', y1, x0 + 0.08, x1 - 0.08, 0.16, H + 0.1, 4, pan, rnd, ribs_mat=t.frame)
    # Südfassade: Sockel, beleuchtetes Fensterband mit Blick auf Werkbank und Greifer, Sturz
    kit.wall_panels(o, 'X', y0, x0 + 0.08, x1 - 0.08, 0.16, 0.48, 4, pan, rnd, outward=-1)
    kit.wall_panels(o, 'X', y0, x0 + 0.08, x1 - 0.08, H - 0.1, H + 0.1, 4, pan, rnd, outward=-1)
    o.append(eisen.box('win', (x1 - x0 - 0.2, 0.03, H - 0.58), (cx, y0 + 0.03, 0.48 + (H - 0.58) / 2), t.glass))
    o.append(eisen.box('winlight', (x1 - x0 - 0.3, 0.02, 0.03), (cx, y0 + 0.1, H - 0.14), kit.glow('am2wl', '#ffd9a0', 3.0)))
    for x in (cx - 0.55, cx, cx + 0.55):
        kit.plate(o, f'mull{x:.2f}', (0.045, 0.05, H - 0.56), (x, y0 - 0.01, 0.48 + (H - 0.58) / 2), t.frame, bevel=0.0)
    a = phase * math.tau
    kit.plate(o, 'bench', (1.6, 0.5, 0.08), (cx, y0 + 0.4, 0.52), t.metal)
    ax, ay = cx + math.cos(a) * 0.45, y0 + 0.4 + math.sin(a) * 0.12
    o.append(beam('jib', (cx, y0 + 0.7, 0.92), (ax, ay, 0.85), (0.05, 0.05), t.hazard))
    kit.plate(o, 'tool', (0.08, 0.08, 0.16), (ax, ay, 0.72), t.dark)
    # Dach (blau lackiert) mit aufgesetztem Lüfterturm, Gitter, Geländer
    Z = H + 0.12
    kit.plate(o, 'roofrim', (x1 - x0 + 0.14, y1 - y0 + 0.14, 0.06), (cx, cy, Z), t.frame, bevel=0.01)
    kit.paneled_top(o, x0, y0, x1, y1, Z + 0.03, 3, 3, [t.panels[0], t.panels[1]], rnd, gap=0.02, thick=0.03, bolts_mat=t.metal)
    tx, ty = cx + 0.35, cy + 0.25
    kit.plate(o, 'tower', (1.15, 1.15, 0.3), (tx, ty, Z + 0.06 + 0.15), t.panels[1], bevel=0.02)
    kit.plate(o, 'towerrim', (1.2, 1.2, 0.04), (tx, ty, Z + 0.37), t.frame, bevel=0.01)
    kit.fan(o, 'fan', 0.44, (tx, ty, Z + 0.39), phase, t)
    kit.grille(o, 'gr1', 0.62, 0.38, (cx - 0.55, cy - 0.65, Z + 0.06), t.frame, t.metal)
    kit.grille(o, 'gr2', 0.38, 0.62, (cx - 0.8, cy + 0.35, Z + 0.06), t.frame, t.metal)
    kit.railing(o, [(x0, y1, Z + 0.06), (x1, y1, Z + 0.06), (x1, y0 + 0.4, Z + 0.06)], 0.2, t.hazard)
    kit.beacon_light(o, 'warn', (x1 - 0.12, y0 + 0.12, Z + 0.06), kit.glow('am2warn', '#ffa53a', 4.0), t)
    # Deck Ost/Süd: Schaltschrank mit LEDs, Rohrleitung, Kabeltrasse, Leiter
    kit.plate(o, 'cab', (0.34, 0.28, 0.62), (1.2, -1.15, 0.15 + 0.31), t.accent, bevel=0.015)
    kit.plate(o, 'cabroof', (0.38, 0.32, 0.03), (1.2, -1.15, 0.79), t.frame)
    for k, c in enumerate(('#6cff7a', '#ffb347', '#ff5040')):
        o.append(eisen.cylinder(f'led{k}', 0.016, 0.02, (1.12 + k * 0.07, -1.30, 0.62), kit.glow(f'am2led{k}', c, 4.0), segments=8, rot=(math.pi / 2, 0, 0)))
    kit.plate(o, 'cabdoor', (0.28, 0.01, 0.4), (1.2, -1.296, 0.4), t.frame, bevel=0.0)
    kit.pipe_run(o, 'pr', [(1.22, 1.45, 0.3), (1.22, -0.7, 0.3), (0.6, -1.22, 0.3), (-1.45, -1.22, 0.3)], 0.045, t.metal, t.frame)
    for k in range(5):
        kit.plate(o, f'pbr{k}', (0.14, 0.06, 0.16), (1.22, 1.2 - k * 0.45, 0.22), t.frame, bevel=0.0)
    kit.cable(o, 'tray', [(1.2, -0.95, 0.75), (1.0, -0.9, 0.95), (x1 + 0.02, -0.5, Z)], 0.02, t.rubber)
    kit.ladder(o, 'lad', x1 + 0.05, 0.6, 0.15, Z + 0.25, t.metal, facing='X')
    kit.greebles(o, rnd, 1.08, -0.4, 1.38, 0.9, 0.16, 5, t, hmax=0.12)
    kit.greebles(o, rnd, cx + 0.2, y0 + 0.1, x1 - 0.1, cy - 0.5, Z + 0.06, 4, t, hmax=0.07)
    return eisen.parent_all(o, 'assembler2')


# --------------------------------------------------------------------------- Stufe 3: Hochtechnik

def assembler3(_m, phase=0.0):
    t = kit.Tier(3, accent='#2f6f68', prefix='am3')
    rnd = kit.rng(303)
    o = []
    H = 1.0
    cyan = kit.glow('am3cyan', '#5ef2e0', 5.0)
    kit.plate(o, 'pad', (2.96, 2.96, 0.1), (0, 0, 0.05), t.panels[1], bevel=0.04)
    # Gehäuse: gefaste Hauptform, umlaufende Graphit-Sockelzone
    o.append(eisen.box('plinth', (2.78, 2.78, 0.3), (0, 0, 0.25), t.frame, bevel=0.06))
    o.append(eisen.box('body', (2.62, 2.62, H - 0.3), (0, 0, 0.4 + (H - 0.3) / 2), t.panels[0], bevel=0.12))
    # Feine Paneelfugen auf den Seiten (Kamera: Süd), Leuchtstreifen in der Sockelfuge
    for x in (-0.65, 0.0, 0.65):
        kit.plate(o, f'seamS{x}', (0.012, 0.01, H - 0.45), (x, -1.312, 0.4 + (H - 0.3) / 2), t.frame, bevel=0.0)
    kit.light_strip(o, 'stripS', (-1.2, -1.395, 0.42), (1.2, -1.395, 0.42), cyan, (0.02, 0.015))
    for s in (-1, 1):
        kit.light_strip(o, f'stripE{s}', (s * 1.395, -1.2, 0.42), (s * 1.395, 1.2, 0.42), cyan, (0.02, 0.015))
    # Südseite: Wartungsklappe mit Display
    kit.plate(o, 'door', (0.7, 0.02, 0.42), (-0.7, -1.315, 0.68), t.panels[1], bevel=0.005)
    o.append(eisen.box('disp', (0.4, 0.012, 0.12), (-0.7, -1.33, 0.76), kit.glow('am3disp', '#7fe8ff', 2.5)))
    for k in range(3):
        o.append(eisen.box(f'vent{k}', (0.5, 0.015, 0.02), (0.6, -1.32, 0.55 + k * 0.06), t.inner))
    # Dach: Graphitdeck mit Fugen, Kühlrippen, Glasluke mit Roboterarm
    Z = 0.4 + (H - 0.3)
    kit.paneled_top(o, -1.15, -1.15, 1.15, 1.15, Z - 0.01, 4, 4, [t.panels[1]], rnd, gap=0.012, thick=0.02)
    # Kühlrippen-Blöcke (viele dünne Lamellen = feine Struktur)
    for bx, by in ((-0.72, 0.72), (-0.72, -0.72)):
        kit.plate(o, f'hsb{bx}{by}', (0.62, 0.62, 0.04), (bx, by, Z + 0.03), t.frame, bevel=0.01)
        for k in range(12):
            kit.plate(o, f'fin{bx}{by}{k}', (0.56, 0.012, 0.12), (bx, by - 0.27 + k * 0.049, Z + 0.11), t.metal, bevel=0.0)
    # Glasluke rechts, darin drehender Arm mit Leuchtkopf
    cx, cy = 0.55, 0.0
    o.append(eisen.cylinder('porttower', 0.66, 0.22, (cx, cy, Z + 0.11), t.panels[0], segments=48, bevel=0.03))
    Z += 0.22
    o.append(eisen.cylinder('portring', 0.62, 0.08, (cx, cy, Z + 0.04), t.frame, segments=48, bevel=0.02))
    o.append(eisen.cylinder('portwell', 0.55, 0.02, (cx, cy, Z + 0.03), t.inner, segments=48))
    a = phase * math.tau
    o.append(eisen.cylinder('armbase', 0.12, 0.08, (cx, cy, Z + 0.05), t.metal, segments=20))
    ex, ey = cx + math.cos(a) * 0.35, cy + math.sin(a) * 0.35
    o.append(beam('arm1', (cx, cy, Z + 0.1), (ex, ey, Z + 0.1), (0.06, 0.05), t.accent))
    o.append(eisen.cylinder('armhead', 0.05, 0.05, (ex, ey, Z + 0.1), cyan, segments=12))
    gl = eisen.material('am3dome', eisen.srgb('#9fd8e0'), rough=0.02, metal=0.0)
    bsdf = gl.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Transmission Weight'].default_value = 0.85
    bsdf.inputs['Alpha'].default_value = 0.55
    o.append(eisen.cylinder('portglass', 0.56, 0.015, (cx, cy, Z + 0.17), gl, segments=48))
    for k in range(8):
        b = k / 8 * math.tau
        o.append(eisen.cylinder(f'pb{k}', 0.018, 0.015, (cx + math.cos(b) * 0.59, cy + math.sin(b) * 0.59, Z + 0.085), t.metal, segments=6))
    Z -= 0.22
    kit.light_strip(o, 'towerlight', (cx - 0.66, cy - 0.05, Z + 0.12), (cx - 0.66, cy + 0.05, Z + 0.12), cyan, (0.015, 0.1))
    # Statuslichter und Antenne
    for k in range(4):
        o.append(eisen.cylinder(f'st{k}', 0.02, 0.015, (-1.05 + k * 0.08, -0.05, Z + 0.015), kit.glow(f'am3st{k}', '#5ef2e0' if k else '#ffcf5a', 4.0), segments=8))
    o.append(eisen.cylinder('ant', 0.015, 0.35, (1.1, 1.1, Z + 0.17), t.metal, segments=8))
    o.append(eisen.cylinder('anttip', 0.03, 0.03, (1.1, 1.1, Z + 0.35), cyan, segments=8))
    kit.light_strip(o, 'rooflight', (-1.15, -1.18, Z + 0.01), (1.15, -1.18, Z + 0.01), cyan, (0.015, 0.012))
    return eisen.parent_all(o, 'assembler3')
