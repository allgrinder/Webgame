"""Rohölquellen: dunkler, öliger Fleck mit glänzender Lache, Blasen und Steinkranz.
Je 6 Varianten × 4 Stufen (Ergiebigkeit) als res.crude-oil.{v}.{stufe}, gleiches Raster wie die Erzfelder."""
import math
import random

import bmesh
import bpy
import eisen
import gw_ground
import gw_lib
from mathutils import Euler
from natur import disc, patch_material

P = gw_lib.P
lin = gw_ground.lin
SIZE = 1.5


def oil_material(name):
    """Fast schwarz, sehr glatt, mit leicht violettem Schimmer (Ölfilm)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (0.012, 0.01, 0.012, 1)
    b.inputs['Roughness'].default_value = 0.06
    b.inputs['Metallic'].default_value = 0.0
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = 0.6
    if 'Thin Film Thickness' in b.inputs:
        b.inputs['Thin Film Thickness'].default_value = 420.0
    return m


def puddle(name, r, loc, mat, rnd, flat=0.12):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=12, radius=1.0)
    for v in bm.verts:
        a = math.atan2(v.co.y, v.co.x)
        k = 1 + 0.18 * math.sin(3 * a + rnd.uniform(0, 6)) + 0.1 * math.sin(5 * a + rnd.uniform(0, 6))
        v.co.x *= k
        v.co.y *= k
        v.co.z = max(v.co.z, -0.2)
    ob = eisen.mesh_obj(name, bm, mat)
    ob.scale = (r, r * rnd.uniform(0.8, 1.0), r * flat)
    ob.location = loc
    ob.rotation_euler = (0, 0, rnd.uniform(0, 6.28))
    return ob


def render(out):
    for v in range(6):
        for d in range(4):
            eisen.reset(samples=40, ground=False)
            rnd = random.Random(5000 + 31 * v + d)
            ground = patch_material(f'oilg{v}{d}', ('#1e1a17', '#2a2420'), 200 + v * 4 + d, noise_amp=0.5,
                                    opacity=0.55 + 0.12 * d, bump_strength=0.4)
            disc(0.45 + 0.05 * d, ground)
            oil = oil_material(f'oil{v}{d}')
            r = 0.16 + 0.04 * d
            puddle('pool', r, P(rnd.uniform(-0.04, 0.04), rnd.uniform(-0.04, 0.04), 0.0), oil, rnd)
            # kleine Nebenlachen
            for k in range(1 + d):
                a = rnd.uniform(0, math.tau)
                dist = r + rnd.uniform(0.06, 0.16)
                puddle(f'drop{k}', rnd.uniform(0.04, 0.08), P(math.cos(a) * dist, math.sin(a) * dist, 0.0), oil, rnd, 0.1)
            # Blasen auf der Lache
            for k in range(2 + d):
                a = rnd.uniform(0, math.tau)
                dist = r * 0.6 * math.sqrt(rnd.random())
                br = rnd.uniform(0.012, 0.03)
                eisen.cylinder(f'bub{k}', br, br * 0.8, P(math.cos(a) * dist, math.sin(a) * dist, r * 0.11), oil, segments=12,
                               bevel=br * 0.38)
            # Steine am Rand
            tones = ['#3d3630', '#4a423a', '#2e2925']
            mats = [gw_ground.pmat(f'ost{i}{v}{d}', lin(h), 0.85, 0.2, 0.4, 25) for i, h in enumerate(tones)]
            meshes = [gw_ground.pebble_mesh(f'osm{i}', 1.0, rnd, 0.5, 1, False, 0.2) for i in range(4)]
            for k in range(4 + d):
                a = rnd.uniform(0, math.tau)
                dist = r + rnd.uniform(0.05, 0.22)
                s = rnd.uniform(0.025, 0.055)
                ob = bpy.data.objects.new('ost', meshes[k % len(meshes)])
                ob.scale = (s, s, s)
                ob.location = P(math.cos(a) * dist, math.sin(a) * dist, s * 0.2)
                ob.rotation_euler = Euler((0, 0, rnd.uniform(0, 6.28)))
                gw_lib.link(ob, outline=False)
                if not ob.data.materials:
                    ob.data.materials.append(mats[0])
                ob.material_slots[0].link = 'OBJECT'
                ob.material_slots[0].material = mats[k % len(mats)]
            eisen.shadow_catcher(6)
            eisen.camera(SIZE, SIZE)
            name = f'res.crude-oil.{v}.{d}'
            out.add(name, 'terrain', [out.render_frame(name, 0)], (0.5, 0.5))
