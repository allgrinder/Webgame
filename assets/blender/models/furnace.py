"""Steinofen: aus, an (Grundzustand mit Glut) und Leuchten als eigene, additive Ebene.

Die Leuchtebene ist die Differenz zwischen einem voll brennenden Ofen (Flammen + Lichtschein)
und dem Grundzustand „an“. 8 Frames mit wechselnder Flammenstärke ergeben das Flackern.
"""
import bpy
import eisen
import stufe1
import parts

CANVAS = (2.5, 3.25)
ANCHOR = (0.5, 2.0 / 3.25)
SH_CANVAS = (3.5, 3.5)
SH_ANCHOR = (1.25 / 3.5, 1.25 / 3.5)
GLOW_FRAMES = 8
LEVELS = (0.75, 1.0, 0.85, 0.95, 0.7, 1.0, 0.8, 0.9)


def load_pixels(path):
    img = bpy.data.images.load(path, check_existing=False)
    px = list(img.pixels)
    w, h = img.size
    bpy.data.images.remove(img)
    return px, w, h


def write_diff(full, base, w, h, path):
    out = bpy.data.images.new('glow', w, h, alpha=True)
    px = [0.0] * (w * h * 4)
    tint = (1.0, 0.55, 0.22)
    for i in range(0, len(px), 4):
        fa = full[i + 3]
        ba = base[i + 3]
        lf = (0.3 * full[i] + 0.59 * full[i + 1] + 0.11 * full[i + 2]) * fa
        lb = (0.3 * base[i] + 0.59 * base[i + 1] + 0.11 * base[i + 2]) * ba
        d = max(0.0, lf - lb) * 1.6
        for c in range(3):
            px[i + c] = min(1.0, d * tint[c])
        px[i + 3] = 1.0
    out.pixels = px
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)


def render(out):
    eisen.reset(samples=48)
    stufe1.furnace1(None, fire=0.0)
    eisen.camera(*CANVAS, anchor=ANCHOR)
    out.add('furnace.off', 'entities', [out.render_frame('furnace.off', 0)], ANCHOR)

    eisen.reset(samples=64)
    stufe1.furnace1(None, fire=0.25, seed=11)
    eisen.camera(*CANVAS, anchor=ANCHOR)
    base_path = out.render_frame('furnace.on', 0)
    out.add('furnace.on', 'entities', [base_path], ANCHOR)
    base, w, h = load_pixels(base_path)

    frames = []
    for f in range(GLOW_FRAMES):
        eisen.reset(samples=64)
        stufe1.furnace1(None, fire=LEVELS[f], seed=11)
        eisen.camera(*CANVAS, anchor=ANCHOR)
        tmp = out.frame_path('furnace.glowsrc', f)
        eisen.render_to(tmp)
        full, _, _ = load_pixels(tmp)
        p = out.frame_path('furnace.glow', f)
        import os
        os.makedirs(os.path.dirname(p), exist_ok=True)
        write_diff(full, base, w, h, p)
        frames.append(p)
    out.add('furnace.glow', 'entities', frames, ANCHOR, fps=10, meta={'blend': 'add'})

    eisen.reset(samples=32)
    stufe1.furnace1(None, fire=0.0)
    eisen.shadow_render(out, 'furnace.shadow', 'entities', SH_CANVAS, SH_ANCHOR)
