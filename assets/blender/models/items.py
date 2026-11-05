"""Item-Symbole für Inventar und Band (64×64, gleiche Kamera und Beleuchtung)."""
import math

import bmesh
import anlagen
import stufe23
import eisen
import stufe1
import bohrer
import parts
import stufen


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

    for res, name in (('iron-ore', 'item.iron-ore'), ('coal', 'item.coal'), ('stone', 'item.stone'), ('copper-ore', 'item.copper-ore')):
        icon_scene()
        objs = parts.ore_pile(res, 4, 0.2, seed={'iron-ore': 11, 'coal': 23, 'stone': 37, 'copper-ore': 53}[res], spread=0.2)
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
    root = bohrer.burner_drill(None, 0.0, working=False)
    finish(out, 'item.burner-mining-drill', root, scale=0.42, z=-0.05)

    m = icon_scene()
    root, _ = stufe1.furnace1(None, 0.0)
    finish(out, 'item.stone-furnace', root, scale=0.44, z=-0.05)

    m = icon_scene()
    root = parts.iron_chest(m)
    finish(out, 'item.iron-chest', root, scale=0.8, z=-0.05)

    render_new(out)
    render_early(out)


def plates(name, mat):
    objs = [eisen.box('p1', (0.7, 0.5, 0.07), (0, 0, 0.035), mat, bevel=0.02),
            eisen.box('p2', (0.7, 0.5, 0.07), (0.04, 0.05, 0.11), mat, bevel=0.02)]
    root = eisen.parent_all(objs)
    root.rotation_euler = (0, 0, math.radians(20))
    return root


def render_new(out):
    """Items der Strom-, Montage-, Forschungs- und Logistikstufe."""
    eisen.reset(samples=48)
    a = anlagen.Mats()
    finish(out, 'item.copper-plate', plates('cp', a.copper))

    eisen.reset(samples=48)
    finish(out, 'item.copper-cable', anlagen.copper_coil(anlagen.Mats()), scale=1.1)

    eisen.reset(samples=48)
    r = anlagen.stick_bundle(anlagen.Mats())
    r.rotation_euler = (0, 0, math.radians(30))
    finish(out, 'item.iron-stick', r)

    eisen.reset(samples=48)
    r = anlagen.brick_stack(anlagen.Mats())
    r.rotation_euler = (0, 0, math.radians(25))
    finish(out, 'item.stone-brick', r, scale=1.05)

    eisen.reset(samples=48)
    r = anlagen.circuit(anlagen.Mats())
    r.rotation_euler = (math.radians(-15), 0, math.radians(15))
    finish(out, 'item.electronic-circuit', r, scale=1.05)

    eisen.reset(samples=48)
    r = anlagen.pipe_piece(anlagen.Mats(), 5)
    r.rotation_euler = (0, 0, math.radians(40))
    finish(out, 'item.pipe', r, scale=1.0, z=-0.1)

    for item, color in (('automation-science-pack', (0.85, 0.12, 0.08)), ('logistic-science-pack', (0.15, 0.75, 0.2))):
        eisen.reset(samples=48)
        finish(out, f'item.{item}', anlagen.flask(anlagen.Mats(), color), scale=1.2, z=-0.08)

    builds = [
        ('offshore-pump', lambda m: stufe1.offshore_pump1(None), 0.55),
        ('boiler', lambda m: stufe1.boiler1(None, 0.0), 0.3),
        ('steam-engine', lambda m: stufe1.steam_engine1(None, 0.0), 0.19),
        ('small-electric-pole', lambda m: anlagen.small_pole(m), 0.5),
        ('electric-mining-drill', lambda m: bohrer.electric_drill(None, 0.0), 0.26),
        ('assembling-machine-1', lambda m: stufen.assembler1(m, 0.0), 0.3),
        ('lab', lambda m: stufe1.lab1(None, 0.0), 0.3),
        ('splitter', lambda m: anlagen.splitter(m, 0.0), 0.42),
        ('underground-belt', lambda m: anlagen.underground(m, False), 0.8),
    ]
    for item, fn, sc in builds:
        eisen.reset(samples=48)
        root = fn(anlagen.Mats())
        if item == 'steam-engine':
            root.rotation_euler = (0, 0, math.pi / 2)
        finish(out, f'item.{item}', root, scale=sc, z=-0.05)

    # Greifarme in ihren Farben, schnelles Band
    import bauten
    for item, paint, burner in (('inserter', '#5d6a3a', False), ('long-handed-inserter', '#6e3527', False)):
        eisen.reset(samples=48)
        m = parts.Mats()
        m.ochre = bauten.weathered('ins_paint', paint, metal=0.3, rough=0.55, rust=0.4, dust=0.45, edge=0.7, streaks=0.5)
        base = parts.inserter_base(m, burner)
        arm = parts.inserter_arm(m, 0.55 if item == 'inserter' else 0.75)
        arm.rotation_euler = (0, 0, math.radians(-40))
        finish(out, f'item.{item}', eisen.parent_all([base, arm]), scale=0.92 if item == 'inserter' else 0.8, z=-0.1)

    eisen.reset(samples=48)
    m = parts.Mats()
    m.ochre = bauten.weathered('fb_paint', '#7a3a28', metal=0.3, rough=0.55, rust=0.4, dust=0.45, edge=0.7, streaks=0.5)
    root = belt_piece(m)
    root.rotation_euler = (0, 0, math.radians(35))
    finish(out, 'item.fast-transport-belt', root, scale=0.95)


def steel_ingots(m):
    """Stahl: dunkle, bläuliche, dicke Barren mit Fase, über Kreuz gestapelt (deutlich anders als Eisenblech)."""
    import bauten
    st = bauten.weathered('a_steelingot', '#3e4855', metal=0.95, rough=0.3, rust=0.0, dust=0.1, edge=0.6, grime=0.1)
    o = []
    for k, (x, y, z, rot) in enumerate(((-0.12, 0, 0.07, 0), (0.12, 0, 0.07, 0), (0, 0, 0.21, 90))):
        o.append(eisen.box(f'ingot{k}', (0.2, 0.62, 0.14), (x, y, z), st, bevel=0.035, rot=(0, 0, math.radians(rot))))
    root = eisen.parent_all(o, 'steel')
    root.rotation_euler = (0, 0, math.radians(25))
    return root


def render_early(out):
    """Items der frühen Phase (Holz, Stahl, Masten, Montage 2 …)."""
    import bauten
    simple = [
        ('wood', lambda m: anlagen.wood_logs(m), 1.0),
        ('steel-plate', steel_ingots, 1.0),
        ('engine-unit', lambda m: anlagen.engine_unit(m), 1.15),
        ('landfill', lambda m: anlagen.landfill_pile(m), 1.1),
        ('wooden-chest', lambda m: anlagen.wooden_chest(m), 0.8),
        ('steel-chest', lambda m: anlagen.steel_chest(m), 0.78),
        ('pipe-to-ground', lambda m: anlagen.pipe_ground(m), 0.95),
        ('lamp', lambda m: anlagen.lamp(m, 0.0), 0.9),
        ('medium-electric-pole', lambda m: anlagen.medium_pole(m), 0.42),
        ('big-electric-pole', lambda m: anlagen.big_pole(m), 0.26),
        ('steel-furnace', lambda m: stufe23.steel_furnace2(m, 0.0), 0.42),
        ('pump', lambda m: anlagen.fluid_pump(m, 0.0), 0.5),
        ('storage-tank', lambda m: stufe23.storage_tank2(m), 0.3),
    ]
    for item, fn, sc in simple:
        eisen.reset(samples=48)
        root = fn(anlagen.Mats())
        if item in ('pipe-to-ground', 'pump'):
            root.rotation_euler = (0, 0, math.radians(35))
        finish(out, f'item.{item}', root, scale=sc, z=-0.05)
    eisen.reset(samples=48)
    finish(out, 'item.assembling-machine-2', stufen.assembler2(None, 0.0), scale=0.3, z=-0.05)
    for item, fn, sc in (('fast-splitter', lambda m: anlagen.splitter(m, 0.0), 0.42), ('fast-underground-belt', lambda m: anlagen.underground(m, False), 0.8)):
        eisen.reset(samples=48)
        m = anlagen.Mats()
        m.paint = anlagen.paint('#7a3a28', 'a_fastpaint')
        finish(out, f'item.{item}', fn(m), scale=sc, z=-0.05)
    eisen.reset(samples=48)
    m = parts.Mats()
    m.ochre = bauten.weathered('ins_paint', '#3f5d80', metal=0.3, rough=0.55, rust=0.4, dust=0.45, edge=0.7, streaks=0.5)
    base = parts.inserter_base(m, False)
    arm = parts.inserter_arm(m, 0.55)
    arm.rotation_euler = (0, 0, math.radians(-40))
    finish(out, 'item.fast-inserter', eisen.parent_all([base, arm]), scale=0.92, z=-0.1)

