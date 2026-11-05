"""Ölstufe: Pumpjack, Ölraffinerie, Chemiefabrik (je 4 Richtungen, animiert), elektrischer Ofen (aus/an/Leuchten)
und Umspannwerk (mit Kabelhöhe im Manifest)."""
import math

import anlagen
import stufe23
import kit
import eisen

ALL = (0, 1, 2, 3)
TAN = math.tan(eisen.TILT)
EF_CANVAS = (3.75, 4.5)
EF_ANCHOR = (0.5, 2.6 / 4.5)
LEVELS = (0.75, 1.0, 0.85, 0.95, 0.7, 1.0, 0.8, 0.9)


def ef(m, fire):
    """Elektroofen (Stufe 3) mit automatischem Detail-Durchgang."""
    root = anlagen.electric_furnace(m, fire)
    if root is not None:
        kit.detail_pass(root, 3, seed=5)
    return root


def electric_furnace(out):
    eisen.reset(samples=48)
    ef(anlagen.Mats(), 0.0)
    eisen.camera(*EF_CANVAS, anchor=EF_ANCHOR)
    out.add('electric-furnace.off', 'entities', [out.render_frame('electric-furnace.off', 0)], EF_ANCHOR)
    eisen.reset(samples=64)
    ef(anlagen.Mats(), 0.25)
    eisen.camera(*EF_CANVAS, anchor=EF_ANCHOR)
    base_path = out.render_frame('electric-furnace.on', 0)
    out.add('electric-furnace.on', 'entities', [base_path], EF_ANCHOR)
    base, w, h = anlagen.load_pixels(base_path)
    frames = []
    for f, lv in enumerate(LEVELS):
        eisen.reset(samples=64)
        ef(anlagen.Mats(), lv)
        eisen.camera(*EF_CANVAS, anchor=EF_ANCHOR)
        tmp = out.frame_path('electric-furnace.glowsrc', f)
        eisen.render_to(tmp)
        full, _, _ = anlagen.load_pixels(tmp)
        p = out.frame_path('electric-furnace.glow', f)
        anlagen.write_glow_diff(full, base, w, h, p)
        frames.append(p)
    out.add('electric-furnace.glow', 'entities', frames, EF_ANCHOR, fps=10, meta={'blend': 'add'})
    eisen.reset(samples=32)
    ef(anlagen.Mats(), 0.0)
    eisen.shadow_render(out, 'electric-furnace.shadow', 'entities', (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75))


def render(out):
    anlagen.building(out, 'pumpjack', stufe23.pumpjack2, (3.75, 4.75), (0.5, 2.85 / 4.75),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), dirs=ALL, frames=8, samples=36, tier=2)
    anlagen.building(out, 'chemical-plant', stufe23.chemical_plant2, (3.75, 4.5), (0.5, 2.6 / 4.5),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), dirs=ALL, frames=8, samples=36, tier=2)
    anlagen.building(out, 'oil-refinery', stufe23.oil_refinery2, (5.5, 6.75), (0.5, 3.65 / 6.75),
                     (8.0, 8.0), (3.0 / 8.0, 3.0 / 8.0), dirs=ALL, frames=4, samples=36, tier=2)
    electric_furnace(out)
    anlagen.building(out, 'substation', lambda m, ph: stufe23.substation2(m), (2.75, 4.0), (0.5, 2.9 / 4.0),
                     (4.0, 4.0), (1.25 / 4.0, 1.25 / 4.0), frames=1, samples=40,
                     meta={'wireLift': round((anlagen.SUBSTATION_TOP - 0.05) * TAN, 4)})
