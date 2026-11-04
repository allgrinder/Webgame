"""Gemeinsame Blender-Hilfen für Eisenwerk (headless, ohne .blend-Dateien).

Koordinaten: Blender X = Spiel-x (Osten), Blender Y = Norden (= -Spiel-y), Z = oben.
Ein Feld = 1 Blender-Einheit = 128 Pixel (im Spiel als Auflösung 2 auf 64 Welteinheiten). Kamera orthografisch, um TILT geneigt (sieht Südseiten),
Licht von links oben (Nordwesten).
"""
import json
import math
import os
import random

import bmesh
import bpy
import mathutils

TILE_PX = 128
TILT = math.radians(30)
SAMPLES = 48
LIGHT_DIR = mathutils.Vector((0.55, -0.45, -0.70)).normalized()  # Richtung des Lichts (von NW oben)


# --------------------------------------------------------------------------- Szene

def reset(samples=SAMPLES, ground=True):
    """Szene wie in Gartenwerk (gw_lib.reset_scene): AgX, warme Sonne von links oben, kühles Himmelslicht,
    unsichtbarer Boden für Streulicht. Dazu Eisenwerk-Einstellungen (kein Denoiser verfügbar, 8 Bit)."""
    import gw_lib
    import gw_plants
    s = gw_lib.reset_scene(samples, ground=ground, outlines=False)
    gw_plants.reset_cache()
    if bpy.app.version >= (4, 2, 0):
        # bpy 5.x (wie Gartenwerk): Denoiser verfügbar, daher halbe Samples
        s.cycles.samples = max(12, samples // 2)
        s.cycles.use_denoising = True
        s.cycles.denoiser = 'OPENIMAGEDENOISE'
    else:
        s.cycles.use_denoising = False
    s.cycles.seed = 7
    s.render.filter_size = 1.0
    s.render.image_settings.color_depth = '8'
    s.render.threads_mode = 'AUTO'
    return s


def camera(canvas_w, canvas_h, anchor=(0.5, 0.5), target=(0.0, 0.0, 0.0), tilt=TILT):
    """Kamera so setzen, dass der Weltpunkt target auf dem Anker (0..1, von links oben) liegt."""
    s = bpy.context.scene
    s.render.resolution_x = round(canvas_w * TILE_PX)
    s.render.resolution_y = round(canvas_h * TILE_PX)
    s.render.resolution_percentage = 100
    c = math.cos(tilt)
    s.render.pixel_aspect_x = 1.0 / c if c < 0.9999 else 1.0
    s.render.pixel_aspect_y = 1.0
    cam = bpy.data.cameras.get('cam') or bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.sensor_fit = 'HORIZONTAL'
    cam.ortho_scale = canvas_w
    cam.clip_start = 0.01
    cam.clip_end = 100
    co = bpy.data.objects.get('cam')
    if not co:
        co = bpy.data.objects.new('cam', cam)
        s.collection.objects.link(co)
    s.camera = co
    view = mathutils.Vector((0, math.sin(tilt), -math.cos(tilt)))
    up = mathutils.Vector((0, math.cos(tilt), math.sin(tilt)))
    right = mathutils.Vector((1, 0, 0))
    dx = (anchor[0] - 0.5) * canvas_w  # Felder nach rechts
    dy = (anchor[1] - 0.5) * canvas_h  # Felder nach unten (Bild)
    p = mathutils.Vector(target)
    t = p - right * dx + up * (dy * c)
    co.location = t - view * 20
    co.rotation_euler = (tilt, 0, 0)
    return co


def render_to(path):
    s = bpy.context.scene
    os.makedirs(os.path.dirname(path), exist_ok=True)
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)


# --------------------------------------------------------------------------- Materialien

def _bsdf(mat):
    return mat.node_tree.nodes['Principled BSDF']


def material(name, color, rough=0.6, metal=0.0, noise=0.15, noise_scale=18.0, wear=0.0, rust=0.0,
             rust_color=(0.32, 0.16, 0.07), emission=None, emission_strength=0.0, bump=0.0):
    """Principled-Material mit Rauschen (gedeckt, abgenutzt). Werte in linearen Farben."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    n = nt.nodes
    L = nt.links
    b = _bsdf(mat)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    tex = n.new('ShaderNodeTexCoord')
    nz = n.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = noise_scale
    nz.inputs['Detail'].default_value = 6
    L.new(tex.outputs['Object'], nz.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    base = mathutils.Color(color[:3])
    dark = [max(0, v * (1 - noise)) for v in color[:3]]
    light = [min(1, v * (1 + noise)) for v in color[:3]]
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].color = (*light, 1)
    L.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    col_out = ramp.outputs['Color']
    if rust > 0:
        nz2 = n.new('ShaderNodeTexNoise')
        nz2.inputs['Scale'].default_value = noise_scale * 0.6
        nz2.inputs['Detail'].default_value = 8
        L.new(tex.outputs['Object'], nz2.inputs['Vector'])
        r2 = n.new('ShaderNodeValToRGB')
        r2.color_ramp.elements[0].position = 1 - rust
        r2.color_ramp.elements[1].position = min(1, 1 - rust + 0.12)
        mix = n.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        L.new(nz2.outputs['Fac'], r2.inputs['Fac'])
        L.new(r2.outputs['Color'], mix.inputs['Factor'])
        L.new(col_out, mix.inputs[6])
        mix.inputs[7].default_value = (*rust_color, 1)
        col_out = mix.outputs[2]
        rr = n.new('ShaderNodeMapRange')
        L.new(r2.outputs['Color'], rr.inputs['Value'])
        rr.inputs['To Min'].default_value = rough
        rr.inputs['To Max'].default_value = 0.95
        L.new(rr.outputs['Result'], b.inputs['Roughness'])
    if wear > 0:
        geo = n.new('ShaderNodeNewGeometry')
        wr = n.new('ShaderNodeValToRGB')
        wr.color_ramp.elements[0].position = 0.5
        wr.color_ramp.elements[1].position = 0.5 + 0.12 / max(0.01, wear)
        L.new(geo.outputs['Pointiness'], wr.inputs['Fac'])
        mix = n.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        L.new(wr.outputs['Color'], mix.inputs['Factor'])
        L.new(col_out, mix.inputs[6])
        mix.inputs[7].default_value = (min(1, base.r * 1.6 + 0.08), min(1, base.g * 1.6 + 0.08), min(1, base.b * 1.6 + 0.08), 1)
        col_out = mix.outputs[2]
    L.new(col_out, b.inputs['Base Color'])
    if bump > 0:
        bn = n.new('ShaderNodeBump')
        bn.inputs['Strength'].default_value = bump
        L.new(nz.outputs['Fac'], bn.inputs['Height'])
        L.new(bn.outputs['Normal'], b.inputs['Normal'])
    if emission is not None:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = emission_strength
    return mat


def emission_material(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    n = mat.node_tree.nodes
    for x in list(n):
        n.remove(x)
    out = n.new('ShaderNodeOutputMaterial')
    em = n.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    mat.node_tree.links.new(em.outputs[0], out.inputs[0])
    return mat


def srgb(hexstr):
    """'#rrggbb' -> lineare RGB-Werte."""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# --------------------------------------------------------------------------- Geometrie

def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_obj(name, bm, mat=None, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    if mat:
        o.data.materials.append(mat)
    return link(o)


def box(name, size, loc=(0, 0, 0), mat=None, bevel=0.0, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    o = mesh_obj(name, bm, mat)
    o.location = loc
    o.rotation_euler = rot
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 2
        m.limit_method = 'ANGLE'
    return o


def cylinder(name, radius, depth, loc=(0, 0, 0), mat=None, segments=24, rot=(0, 0, 0), bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=depth)
    o = mesh_obj(name, bm, mat, smooth=True)
    o.location = loc
    o.rotation_euler = rot
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 2
        m.limit_method = 'ANGLE'
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
    sm = o.modifiers.new('ws', 'WEIGHTED_NORMAL') if False else None
    return o


def rock(name, radius, loc, mat, seed, squash=0.6, detail=2):
    """Unregelmäßiger Brocken aus einer verformten Ikosphäre."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=radius)
    for v in bm.verts:
        k = 1 + (rnd.random() - 0.5) * 0.55
        v.co *= k
        v.co.z *= squash
    o = mesh_obj(name, bm, mat)
    o.location = loc
    o.rotation_euler = (rnd.random() * 0.4, rnd.random() * 0.4, rnd.random() * math.tau)
    return o


def parent_all(objs, name='root'):
    root = bpy.data.objects.new(name, None)
    link(root)
    for o in objs:
        o.parent = root
    return root


def shadow_catcher(size=8.0):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    o = mesh_obj('catcher', bm, material('catcher', (0.5, 0.5, 0.5)))
    o.is_shadow_catcher = True
    return o


def set_camera_visible(objs, visible):
    for o in objs:
        o.visible_camera = visible


def all_mesh_objects():
    """Sichtbare Szenenobjekte (Meshes, Kurven) ohne Schattenfänger und Streulicht-Boden."""
    return [o for o in bpy.context.scene.objects
            if o.type in ('MESH', 'CURVE') and o.name != 'catcher' and not o.name.startswith('ground_bounce')
            and o.visible_camera]


# --------------------------------------------------------------------------- Ausgabe

class Output:
    """Sammelt gerenderte Frames und schreibt sprites.json für die Pipeline."""

    def __init__(self, out_dir):
        self.out_dir = out_dir
        self.sprites = []
        os.makedirs(out_dir, exist_ok=True)

    def frame_path(self, sprite, i):
        safe = sprite.replace('/', '_')
        return os.path.join(self.out_dir, safe, f'{i:03d}.png')

    def add(self, sprite, group, frames, anchor, fps=None, meta=None):
        rel = [os.path.relpath(f, self.out_dir) for f in frames]
        d = {'name': sprite, 'group': group, 'frames': rel, 'anchor': list(anchor)}
        if fps:
            d['fps'] = fps
        if meta:
            d['meta'] = meta
        self.sprites.append(d)

    def add_sheet(self, path, cols, rows, name_fmt, group, anchor=(0.5, 0.5)):
        """Ein großes Bild, das die Pipeline in cols×rows Einzelsprites schneidet.
        name_fmt mit {x} und {y}, z. B. 'ground.{x}.{y}'."""
        self.sprites.append({'sheet': os.path.relpath(path, self.out_dir), 'cols': cols, 'rows': rows,
                             'nameFmt': name_fmt, 'group': group, 'anchor': list(anchor)})

    def render_frame(self, sprite, i):
        p = self.frame_path(sprite, i)
        render_to(p)
        return p

    def finish(self):
        with open(os.path.join(self.out_dir, 'sprites.json'), 'w') as f:
            json.dump(self.sprites, f, indent=1)


def shadow_render(out, sprite, group, canvas, anchor, target=(0, 0, 0), half=False):
    """Schatten-Ebene: Objekte unsichtbar für die Kamera, Boden als Schattenfänger.
    half=True rendert in halber Auflösung (weiche Schatten großer Objekte); das Spiel skaliert ×2."""
    objs = all_mesh_objects()
    lights = [o for o in bpy.context.scene.objects if o.type == 'LIGHT' and o.name != 'sun']
    for l in lights:
        l.hide_render = True
    set_camera_visible(objs, False)
    catcher = shadow_catcher(40)
    camera(canvas[0], canvas[1], anchor, target)
    if half:
        bpy.context.scene.render.resolution_percentage = 50
    p = out.render_frame(sprite, 0)
    out.add(sprite, group, [p], anchor, meta={'scale': 2} if half else None)
    bpy.data.objects.remove(catcher)
    set_camera_visible(objs, True)
    for l in lights:
        l.hide_render = False
    bpy.context.scene.render.resolution_percentage = 100
    return p


def rotate_root(root, d):
    """Spielrichtung d (0=N,1=E,2=S,3=W) -> Drehung um Z (im Uhrzeigersinn von oben)."""
    root.rotation_euler = (0, 0, -d * math.pi / 2)
