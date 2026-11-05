"""Gegner und Verteidigung (eigene Entwürfe): Krabbler (sechsbeinig, gepanzert), Nest (organischer Hügel),
Geschützturm (Sockel + drehbarer Kopf), Steinmauer, Munition und Waffen als Symbole.
Krabbler blicken nach Norden (+Y); die Pipeline dreht sie in 16 Richtungen."""
import math
import random

import bauten
import bmesh
import bpy
import eisen
import gw_ground
import kit
from bauten import beam

lin = gw_ground.lin


def chitin(name, hex_, glossy=0.35):
    m = bauten.weathered(name, hex_, metal=0.1, rough=glossy, rust=0.0, dust=0.25, edge=0.6, grime=0.4, streaks=0.0,
                         rust_hex='#3a2a20', dust_hex='#7a6a52')
    return m


def blob(name, radius, loc, mat, seed, squash=(1.0, 1.0, 0.6), detail=2, jitter=0.18):
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=radius)
    for v in bm.verts:
        k = 1 + (rnd.random() - 0.5) * jitter
        v.co.x *= k * squash[0]
        v.co.y *= k * squash[1]
        v.co.z *= k * squash[2]
    o = eisen.mesh_obj(name, bm, mat, smooth=True)
    o.location = loc
    return o


# --------------------------------------------------------------------------- Krabbler

def krabbler(phase=0.0, dead=False):
    """Sechsbeiniger Krabbler (Länge ≈ 0,9 Felder), Kopf nach +Y. phase 0..1: Laufzyklus (Dreifußgang)."""
    shell = chitin('kr_shell', '#4a3a2c')
    plate = chitin('kr_plate', '#6b4a30', 0.3)
    belly = chitin('kr_belly', '#2a221c', 0.6)
    leg = chitin('kr_leg', '#3a2e24', 0.45)
    eye = eisen.emission_material('kr_eye', (1.0, 0.45, 0.12), 0.0 if dead else 6.0)
    o = []
    z0 = 0.04 if dead else 0.12
    # Körper: Hinterleib, Bruststück, Kopf
    o.append(blob('abd', 0.26, (0, -0.22, z0 + 0.06), belly, 1, (0.9, 1.15, 0.6)))
    for k in range(3):
        o.append(blob(f'abdp{k}', 0.2 - k * 0.03, (0, -0.12 - k * 0.13, z0 + 0.16 - k * 0.02), plate, 10 + k, (1.1, 0.75, 0.45), jitter=0.1))
    o.append(blob('thorax', 0.2, (0, 0.08, z0 + 0.08), shell, 2, (1.0, 0.9, 0.6)))
    o.append(blob('thoraxp', 0.17, (0, 0.1, z0 + 0.17), plate, 3, (1.15, 0.85, 0.4), jitter=0.1))
    o.append(blob('head', 0.13, (0, 0.3, z0 + 0.07), shell, 4, (1.0, 0.9, 0.7)))
    # Mandibeln
    for s in (-1, 1):
        o.append(beam(f'mand{s}', (s * 0.06, 0.38, z0 + 0.05), (s * 0.02, 0.5, z0 + 0.03), (0.035, 0.03), leg))
        o.append(eisen.cylinder(f'eye{s}', 0.025, 0.02, (s * 0.06, 0.37, z0 + 0.14), eye, segments=8, rot=(1.2, 0, 0)))
    # Rückenstacheln
    for k in range(3):
        o.append(beam(f'spike{k}', (0, -0.05 - k * 0.13, z0 + 0.22), (0, -0.1 - k * 0.13, z0 + 0.32), (0.025, 0.02), plate))
    # Beine: Dreifußgang (Paare 0/2 der einen Seite mit 1 der anderen)
    a = phase * math.tau
    for i, y in enumerate((0.16, 0.04, -0.1)):
        for s in (-1, 1):
            grp = (i + (s > 0)) % 2
            swing = math.sin(a + grp * math.pi) * (0 if dead else 0.12)
            lift = max(0, math.cos(a + grp * math.pi)) * (0 if dead else 0.06)
            knee = (s * 0.25, y + swing * 0.5 + (i - 1) * 0.04, z0 + 0.14 + lift)
            foot = (s * (0.34 if not dead else 0.32), y + swing + (i - 1) * 0.08, 0.02 + lift * 0.5 if not dead else 0.03)
            o.append(beam(f'leg{i}{s}a', (s * 0.12, y, z0 + 0.06), knee, (0.055, 0.05), leg))
            o.append(beam(f'leg{i}{s}b', knee, foot, (0.045, 0.04), leg))
            o.append(eisen.cylinder(f'kn{i}{s}', 0.035, 0.05, knee, plate, segments=8))
    root = eisen.parent_all(o, 'krabbler')
    if dead:
        root.rotation_euler = (0, 0.25, 0)
    return root


# --------------------------------------------------------------------------- Nest

def nest(variant=0, ruin=False):
    """Nest 5×5: organischer Hügel aus Wülsten mit Öffnungen, Eiern und Ranken."""
    rnd = random.Random(300 + variant)
    flesh = chitin('ne_flesh', '#4a2c22' if not ruin else '#2e2620', 0.5)
    crust = chitin('ne_crust', '#352a22' if not ruin else '#28221c', 0.75)
    ridge = chitin('ne_ridge', '#5e4a36' if not ruin else '#2a241e', 0.6)
    dark = eisen.material('ne_hole', (0.01, 0.006, 0.004), rough=1.0)
    egg = eisen.emission_material('ne_egg', (0.85, 0.3, 0.08), 0.0 if ruin else 0.9)
    o = []
    # Boden: zerwühlte Erde
    earth = [gw_ground.pmat(f'ne_e{i}', lin(h), 1.0, 0.3, 0.6, 25) for i, h in enumerate(['#3e3226', '#4f3f2e', '#2e261e'])]
    o.extend(bauten.stones(160, rnd, earth, lambda x, y: x * x + y * y < 0.95, (0.03, 0.08)))
    for st in o:
        st.location.x *= 2.4
        st.location.y *= 2.4
    h = 0.35 if ruin else 1.0
    o.append(blob('mound', 1.6, (0, 0, 0.05), crust, 20 + variant, (1.0, 0.95, 0.42 * h), detail=4, jitter=0.4))
    for k in range(12):
        a = k / 12 * math.tau + rnd.uniform(-0.3, 0.3)
        r = rnd.uniform(1.0, 1.8)
        o.append(blob(f'lobe{k}', rnd.uniform(0.3, 0.55), (math.cos(a) * r, math.sin(a) * r, 0.08), flesh, 40 + k + variant * 10,
                      (1.0, 1.0, rnd.uniform(0.45, 0.8) * h), detail=3, jitter=0.4))
    # Grate / Stacheln auf dem Hügel
    for k in range(10):
        a = rnd.uniform(0, math.tau)
        r = rnd.uniform(0.3, 1.3)
        z = 0.65 * h * (1 - (r / 1.6) ** 2) + 0.05
        o.append(beam(f'ridge{k}', (math.cos(a) * r, math.sin(a) * r, z), (math.cos(a) * (r + 0.15), math.sin(a) * (r + 0.15), z + 0.25 * h), (0.07, 0.05), ridge))
    if not ruin:
        for k in range(3):
            a = k / 3 * math.tau + rnd.uniform(-0.4, 0.4)
            r = rnd.uniform(0.3, 0.9)
            o.append(blob(f'hole{k}', 0.24, (math.cos(a) * r, math.sin(a) * r, 0.62), dark, 60 + k, (1.0, 1.0, 0.25), jitter=0.1))
        for k in range(9):
            a = rnd.uniform(0, math.tau)
            r = rnd.uniform(1.9, 2.3)
            o.append(blob(f'egg{k}', rnd.uniform(0.1, 0.15), (math.cos(a) * r, math.sin(a) * r, 0.1), egg, 80 + k, (1.0, 1.0, 1.2), detail=2, jitter=0.1))
    # Ranken
    for k in range(6):
        a = rnd.uniform(0, math.tau)
        kit.cable(o, f'ten{k}', [(math.cos(a) * 1.2, math.sin(a) * 1.2, 0.3 * h), (math.cos(a) * 2.0, math.sin(a) * 2.0, 0.12), (math.cos(a + 0.3) * 2.4, math.sin(a + 0.3) * 2.4, 0.02)],
                  0.05, flesh)
    return eisen.parent_all(o, 'nest')


# --------------------------------------------------------------------------- Geschützturm

def turret_base(m=None):
    """Sockel 2×2: achteckige Betonplatte, gepanzerter Drehkranz, Munitionsklappe."""
    t = kit.Tier(2, accent='#5f6048', prefix='tu')
    o = []
    o.append(eisen.cylinder('plinth', 0.98, 0.2, (0, 0, 0.1), t.frame, segments=8, bevel=0.03, rot=(0, 0, math.pi / 8)))
    o.append(eisen.cylinder('collar', 0.72, 0.22, (0, 0, 0.31), t.panels[0], segments=24, bevel=0.03))
    for k in range(8):
        b = k / 8 * math.tau + math.pi / 8
        o.append(eisen.cylinder(f'bolt{k}', 0.025, 0.03, (math.cos(b) * 0.88, math.sin(b) * 0.88, 0.21), t.metal, segments=6))
    o.append(eisen.box('ammo', (0.36, 0.08, 0.16), (0.0, -0.74, 0.28), t.hazard, bevel=0.01))
    return eisen.parent_all(o, 'turretbase')


def turret_head(m=None):
    """Kopf (Blick nach +Y): gepanzertes Gehäuse mit Doppellauf und Sichtschlitz."""
    t = kit.Tier(2, accent='#5f6048', prefix='th')
    o = []
    o.append(eisen.cylinder('ring', 0.6, 0.12, (0, 0, 0.48), t.frame, segments=24, bevel=0.02))
    o.append(eisen.box('housing', (0.82, 0.86, 0.36), (0, 0.02, 0.68), t.panels[0], bevel=0.08))
    o.append(eisen.box('top', (0.6, 0.5, 0.08), (0, -0.05, 0.89), t.panels[1], bevel=0.03))
    o.append(eisen.box('slit', (0.4, 0.02, 0.05), (0, 0.45, 0.76), eisen.material('th_slit', (0.02, 0.02, 0.02), rough=0.3)))
    for s in (-1, 1):
        o.append(eisen.cylinder(f'barrel{s}', 0.055, 0.85, (s * 0.14, 0.82, 0.66), t.metal, segments=12, rot=(math.pi / 2, 0, 0)))
        o.append(eisen.cylinder(f'muzzle{s}', 0.075, 0.12, (s * 0.14, 1.22, 0.66), t.dark, segments=12, rot=(math.pi / 2, 0, 0)))
        o.append(eisen.box(f'side{s}', (0.06, 0.6, 0.24), (s * 0.44, 0.0, 0.66), t.frame, bevel=0.01))
    o.append(eisen.box('hazard', (0.5, 0.02, 0.05), (0, -0.42, 0.62), t.hazard))
    return eisen.parent_all(o, 'turrethead')


# --------------------------------------------------------------------------- Steinmauer

def wall(m=None):
    """Mauerblock 1×1: gegossene Betonsteine mit Bewehrung und Kappe (Stufe 1)."""
    t = kit.Tier(1, prefix='wa')
    conc = gw_ground.pmat('wa_conc', lin('#8a8274'), 0.95, 0.3, 0.6, 18)
    rnd = random.Random(7)
    o = []
    for k in range(3):
        z = 0.15 + k * 0.28
        w = 0.96 - k * 0.04
        o.append(eisen.box(f'block{k}', (w, w, 0.26), (rnd.uniform(-0.01, 0.01), rnd.uniform(-0.01, 0.01), z), conc, bevel=0.03))
    o.append(eisen.box('cap', (0.9, 0.9, 0.08), (0, 0, 0.88), t.frame, bevel=0.02))
    for k in range(3):
        o.append(eisen.cylinder(f'rebar{k}', 0.012, 0.16, (-0.25 + k * 0.25, 0.1, 0.98), t.metal, segments=6))
    return eisen.parent_all(o, 'wall')


# --------------------------------------------------------------------------- Symbole

def magazine(piercing=False):
    t = kit.Tier(2, prefix='mg')
    body = bauten.weathered('mg_body', '#b08a2e' if not piercing else '#8a3a2a', metal=0.6, rough=0.4, rust=0.1, dust=0.1, edge=0.6)
    o = [eisen.box('mag', (0.3, 0.14, 0.62), (0, 0, 0.31), body, bevel=0.02, rot=(0, 0.12, 0))]
    brass = bauten.weathered('mg_brass', '#c9a24a', metal=0.9, rough=0.3, rust=0.0, dust=0.0, edge=0.3)
    for k in range(2):
        o.append(eisen.cylinder(f'round{k}', 0.05, 0.14, (0.05 + k * 0.08, 0, 0.68), brass, segments=12, rot=(0, 0.12, 0)))
        o.append(eisen.cylinder(f'tip{k}', 0.035, 0.06, (0.06 + k * 0.08, 0, 0.77), t.dark if piercing else brass, segments=12, rot=(0, 0.12, 0)))
    return eisen.parent_all(o, 'magazine')


def gun(smg=False):
    t = kit.Tier(2, prefix='gn')
    o = []
    L = 0.9 if smg else 0.55
    o.append(eisen.box('body', (L, 0.12, 0.16), (0, 0, 0.3), t.frame, bevel=0.02))
    o.append(eisen.cylinder('barrel', 0.035, L * 0.6, (L / 2 + L * 0.25, 0, 0.33), t.metal, segments=10, rot=(0, math.pi / 2, 0)))
    o.append(eisen.box('grip', (0.12, 0.1, 0.28), (-L / 2 + 0.12, 0, 0.12), t.wood if t.wood else t.dark, bevel=0.02, rot=(0, -0.3, 0)))
    if smg:
        o.append(eisen.box('mag', (0.08, 0.08, 0.3), (0.05, 0, 0.12), t.panels[0], bevel=0.01))
        o.append(eisen.box('stock', (0.3, 0.08, 0.12), (-L / 2 - 0.1, 0, 0.3), t.dark, bevel=0.02))
    return eisen.parent_all(o, 'gun')
