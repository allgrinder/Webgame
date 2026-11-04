"""Item-Symbole für Inventar und Band (64×64, gleiche Kamera und Beleuchtung)."""
import math

import bmesh
import eisen
import parts


def icon_scene():
    eisen.reset(samples=48)
    return parts.Mats()


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
    # weicher Schatten unter Items auf dem Band
    eisen.reset(samples=32)
    import bpy
    me = bpy.data.meshes.new('blob')
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.16)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new('blob', me)
    eisen.link(ob)
    ob.location = (0, 0, 0.12)
    ob.scale = (1, 1, 0.5)
    ob.visible_camera = False
    eisen.shadow_catcher(4)
    eisen.camera(0.75, 0.75)
    out.add('item.shadow', 'items', [out.render_frame('item.shadow', 0)], (0.5, 0.5))

    for res, name in (('iron-ore', 'item.iron-ore'), ('coal', 'item.coal'), ('stone', 'item.stone')):
        icon_scene()
        objs = parts.ore_pile(res, 4, 0.2, seed={'iron-ore': 11, 'coal': 23, 'stone': 37}[res], spread=0.2)
        finish(out, name, eisen.parent_all(objs))

    m = icon_scene()
    objs = [eisen.box('p1', (0.7, 0.5, 0.07), (0, 0, 0.035), m.plate, bevel=0.02),
            eisen.box('p2', (0.7, 0.5, 0.07), (0.04, 0.05, 0.11), m.plate, bevel=0.02)]
    root = eisen.parent_all(objs)
    root.rotation_euler = (0, 0, math.radians(20))
    finish(out, 'item.iron-plate', root)

    m = icon_scene()
    g = parts.gear_item(m)
    g.location = (0, 0, 0.05)
    g.rotation_euler = (math.radians(-25), 0, 0.1)
    finish(out, 'item.iron-gear-wheel', g, scale=1.05)

    m = icon_scene()
    root = belt_piece(m)
    root.rotation_euler = (0, 0, math.radians(35))
    finish(out, 'item.transport-belt', root, scale=0.95)

    m = icon_scene()
    base = parts.inserter_base(m)
    arm = parts.inserter_arm(m, 0.55)
    arm.rotation_euler = (0, 0, math.radians(-40))
    root = eisen.parent_all([base, arm])
    finish(out, 'item.burner-inserter', root, scale=0.92, z=-0.1)

    m = icon_scene()
    root = parts.drill(m, 0.0, working=False)
    finish(out, 'item.burner-mining-drill', root, scale=0.42, z=-0.05)

    m = icon_scene()
    root, _ = parts.furnace(m, 0.0)
    finish(out, 'item.stone-furnace', root, scale=0.44, z=-0.05)

    m = icon_scene()
    root = parts.iron_chest(m)
    finish(out, 'item.iron-chest', root, scale=0.8, z=-0.05)
