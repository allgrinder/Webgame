"""Kisten (1×1) im Stil „Endzeit-Industrie“: Holz (Notbau), Eisen (geschweißt), Stahl (Werkstatt), mit Schatten."""
import eisen
import kleinteile

CANVAS = (1.25, 1.6)
ANCHOR = (0.5, 1.0 - 0.6 / 1.6)


def render(out):
    for name, fn in (('iron-chest', kleinteile.iron_chest), ('wooden-chest', kleinteile.wooden_chest),
                     ('steel-chest', kleinteile.steel_chest)):
        eisen.reset(samples=48)
        fn(kleinteile.Mats())
        eisen.camera(*CANVAS, anchor=ANCHOR)
        out.add(name, 'entities', [out.render_frame(name, 0)], ANCHOR)
        eisen.reset(samples=32)
        fn(kleinteile.Mats())
        eisen.shadow_render(out, f'{name}.shadow', 'entities', (1.75, 1.75), (0.3, 0.3))
