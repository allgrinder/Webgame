"""Spielfigur: 8 Richtungen × (16 Lauf-, 8 Ruhe-, 8 Abbau-Frames) mit Spitzhacke, Schatten im Bild.

Richtung k: 0 = Norden, im Uhrzeigersinn in 45°-Schritten. Die Figur ist nach Süden (zur Kamera) modelliert.
"""
import math

import bmesh
import bpy
import eisen
import parts

WALK = 16
IDLE = 8
MINE = 8
CANVAS = (1.25, 1.5)
ANCHOR = (0.5, 1.05 / 1.5)


def sphere(name, r, loc, mat, seg=16):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat)
    o.location = loc
    for p in me.polygons:
        p.use_smooth = True
    eisen.link(o)
    return o


def limb(name, size, pivot, angle, mat, axis=0):
    """Glied, das am oberen Ende (pivot) hängt und um die x-Achse (Vor/Zurück) schwingt."""
    w, d, h = size
    me = eisen.box(name, size, (0, 0, -h / 2), mat, bevel=min(w, d) * 0.3)
    root = bpy.data.objects.new(name + 'P', None)
    eisen.link(root)
    me.parent = root
    root.location = pivot
    rot = [0.0, 0.0, 0.0]
    rot[axis] = angle
    root.rotation_euler = rot
    return root, me


def pickaxe(m, name='pick'):
    """Spitzhacke: Stiel entlang -Z vom Griffpunkt, Kopf quer am Ende."""
    o = []
    o.append(eisen.cylinder(name + 's', 0.018, 0.5, (0, 0, -0.22), m.cloth, segments=8))
    head = eisen.box(name + 'h', (0.03, 0.34, 0.04), (0, 0, -0.46), m.steel, bevel=0.01)
    o.append(head)
    for s in (-1, 1):
        tip = eisen.box(f'{name}t{s}', (0.022, 0.08, 0.03), (0, s * 0.19, -0.47), m.steel, bevel=0.006)
        tip.rotation_euler = (s * 0.3, 0, 0)
        o.append(tip)
    return eisen.parent_all(o, name)


def worker(m, mode='walk', phase=0.0):
    """mode: walk (Laufzyklus), idle (Atmen, Gewicht verlagern), mine (Spitzhacke von oben nach vorn)."""
    o = []
    t = phase * math.tau
    if mode == 'walk':
        swing = math.sin(t) * 0.5
        bob = abs(math.sin(t)) * 0.03
        arm_r = -swing * 0.8
        arm_l = swing * 0.8
        lean = 0.06
    elif mode == 'idle':
        swing = 0.0
        bob = math.sin(t) * 0.006
        arm_r = 0.05 + math.sin(t) * 0.03
        arm_l = -0.05 - math.sin(t) * 0.03
        lean = 0.0
    else:
        swing = 0.12
        # Ausholen (0..0,55), Schlag (0,55..0,7), Zurückziehen
        if phase < 0.55:
            k = phase / 0.55
            arm_r = -0.4 - 2.3 * math.sin(k * math.pi / 2)
        elif phase < 0.7:
            k = (phase - 0.55) / 0.15
            arm_r = -2.7 + 2.5 * k
        else:
            k = (phase - 0.7) / 0.3
            arm_r = -0.2 - 0.2 * k
        arm_l = arm_r * 0.85
        bob = -0.02 if 0.55 <= phase < 0.75 else 0.0
        lean = 0.12 if 0.55 <= phase < 0.8 else 0.04
    body = []
    for side, s in (('L', -1), ('R', 1)):
        leg, _ = limb('leg' + side, (0.1, 0.11, 0.36), (s * 0.075, 0, 0.38), swing * s, m.cloth)
        o.append(leg)
        boot = eisen.box('boot' + side, (0.11, 0.17, 0.07), (s * 0.075, -0.03 - math.sin(swing * s) * 0.17, 0.035), m.dark, bevel=0.02)
        o.append(boot)
    body.append(eisen.box('torso', (0.3, 0.2, 0.34), (0, 0, 0.55 + bob), m.suit, bevel=0.05))
    body.append(eisen.box('belt', (0.31, 0.21, 0.05), (0, 0, 0.4 + bob), m.dark))
    body.append(eisen.box('buckle', (0.06, 0.02, 0.04), (0, -0.11, 0.4 + bob), m.brass))
    body.append(eisen.box('pack', (0.25, 0.13, 0.3), (0, 0.16, 0.57 + bob), m.steel, bevel=0.035))
    body.append(eisen.cylinder('tank', 0.05, 0.24, (0.085, 0.21, 0.62 + bob), m.ochre, segments=12))
    body.append(eisen.box('strapL', (0.04, 0.22, 0.03), (-0.09, 0.0, 0.7 + bob), m.dark))
    body.append(eisen.box('strapR', (0.04, 0.22, 0.03), (0.09, 0.0, 0.7 + bob), m.dark))
    for side, s, ang in (('L', -1, arm_l), ('R', 1, arm_r)):
        arm, _ = limb('arm' + side, (0.085, 0.09, 0.31), (s * 0.2, 0, 0.69 + bob), ang, m.suit)
        o.append(arm)
        glove = sphere('glove' + side, 0.045, (0, 0, -0.32), m.dark, 10)
        glove.parent = arm
        if side == 'R' and mode == 'mine':
            pk = pickaxe(m)
            pk.parent = arm
            pk.location = (0, -0.02, -0.33)
            pk.rotation_euler = (-math.pi / 2 + 0.25, 0, 0)
    if mode != 'mine':
        # Spitzhacke auf dem Rücken
        pk = pickaxe(m, 'back')
        pk.location = (-0.06, 0.24, 0.8 + bob)
        pk.rotation_euler = (0, 0.95, 0)
        o.append(pk)
    body.append(eisen.cylinder('neck', 0.05, 0.06, (0, 0, 0.74 + bob), m.skin, segments=10))
    body.append(sphere('head', 0.11, (0, -0.005, 0.85 + bob), m.skin))
    body.append(eisen.cylinder('helmet', 0.135, 0.08, (0, 0.01, 0.93 + bob), m.ochre, segments=20, bevel=0.035))
    body.append(eisen.cylinder('brim', 0.16, 0.015, (0, -0.01, 0.9 + bob), m.ochre, segments=20))
    body.append(eisen.box('visor', (0.16, 0.03, 0.05), (0, -0.1, 0.86 + bob), m.visor))
    upper = eisen.parent_all(body, 'upper')
    upper.rotation_euler = (lean, 0, 0)
    o.append(upper)
    return eisen.parent_all(o, 'worker')


def render(out):
    for k in range(8):
        rot = math.pi - k * math.pi / 4
        for mode, n, fps in (('walk', WALK, 24), ('idle', IDLE, 6), ('mine', MINE, 12)):
            frames = []
            for f in range(n):
                eisen.reset(samples=40)
                root = worker(parts.Mats(), mode, f / n)
                root.rotation_euler = (0, 0, rot)
                eisen.shadow_catcher(4)
                eisen.camera(*CANVAS, anchor=ANCHOR)
                frames.append(out.render_frame(f'player.{mode}.{k}', f))
            out.add(f'player.{mode}.{k}', 'entities', frames, ANCHOR, fps=fps)
