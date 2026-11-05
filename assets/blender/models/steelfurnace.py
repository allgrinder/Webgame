"""Stahlofen: aus, an und additive Leuchtebene (Differenz brennend − an), wie beim Steinofen."""
import anlagen
import eisen

CANVAS = (2.5, 3.5)
ANCHOR = (0.5, 2.2 / 3.5)
SH_CANVAS = (3.5, 3.5)
SH_ANCHOR = (1.25 / 3.5, 1.25 / 3.5)
LEVELS = (0.75, 1.0, 0.85, 0.95, 0.7, 1.0, 0.8, 0.9)


def render(out):
    eisen.reset(samples=48)
    anlagen.steel_furnace(anlagen.Mats(), 0.0)
    eisen.camera(*CANVAS, anchor=ANCHOR)
    out.add('steel-furnace.off', 'entities', [out.render_frame('steel-furnace.off', 0)], ANCHOR)
    eisen.reset(samples=64)
    anlagen.steel_furnace(anlagen.Mats(), 0.25)
    eisen.camera(*CANVAS, anchor=ANCHOR)
    base_path = out.render_frame('steel-furnace.on', 0)
    out.add('steel-furnace.on', 'entities', [base_path], ANCHOR)
    base, w, h = anlagen.load_pixels(base_path)
    frames = []
    for f, lv in enumerate(LEVELS):
        eisen.reset(samples=64)
        anlagen.steel_furnace(anlagen.Mats(), lv)
        eisen.camera(*CANVAS, anchor=ANCHOR)
        tmp = out.frame_path('steel-furnace.glowsrc', f)
        eisen.render_to(tmp)
        full, _, _ = anlagen.load_pixels(tmp)
        p = out.frame_path('steel-furnace.glow', f)
        anlagen.write_glow_diff(full, base, w, h, p)
        frames.append(p)
    out.add('steel-furnace.glow', 'entities', frames, ANCHOR, fps=10, meta={'blend': 'add'})
    eisen.reset(samples=32)
    anlagen.steel_furnace(anlagen.Mats(), 0.0)
    eisen.shadow_render(out, 'steel-furnace.shadow', 'entities', SH_CANVAS, SH_ANCHOR)
