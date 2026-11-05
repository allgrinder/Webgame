"""Spätes Spiel: Montagemaschine 3, Leuchtfeuer, Roboterhangar, Roboter (fliegend mit Schatten), Logistikkisten,
Radar (drehende Antenne), Raketensilo und Fracht-Landeplatz. Geometrie in lib/spaet.py."""
import anlagen
import eisen
import spaet


def render(out):
    anlagen.building(out, 'assembling-machine-3', spaet.assembler3, (3.75, 4.5), (0.5, 2.6 / 4.5),
                     (4.75, 4.75), (2.0 / 4.75, 2.0 / 4.75), frames=8, samples=36)
    anlagen.building(out, 'beacon', lambda m, ph: spaet.beacon(m, 0.0), (3.5, 4.5), (0.5, 2.75 / 4.5),
                     (4.5, 4.5), (1.9 / 4.5, 1.9 / 4.5), frames=1, samples=40,
                     glow=((0.4, 0.7, 1.0, 0.7), lambda m, lv: spaet.beacon(m, lv)))
    anlagen.building(out, 'roboport', lambda m, ph: spaet.roboport(m), (4.75, 6.0), (0.5, 3.6 / 6.0),
                     (6.0, 6.0), (2.5 / 6.0, 2.5 / 6.0), frames=1, samples=40)
    anlagen.building(out, 'radar', spaet.radar, (3.5, 4.75), (0.5, 3.0 / 4.75),
                     (4.5, 4.5), (1.9 / 4.5, 1.9 / 4.5), frames=8, samples=32)
    anlagen.building(out, 'rocket-silo', lambda m, ph: spaet.rocket_silo(m), (10.0, 13.0), (0.5, 8.0 / 13.0),
                     (13.0, 13.0), (5.0 / 13.0, 5.0 / 13.0), frames=1, samples=40)
    anlagen.building(out, 'cargo-landing-pad', lambda m, ph: spaet.landing_pad(m), (8.75, 10.0), (0.5, 5.6 / 10.0),
                     (10.0, 10.0), (4.4 / 10.0, 4.4 / 10.0), frames=1, samples=40)
    for name, color in spaet.CHESTS.items():
        anlagen.building(out, name, lambda m, ph, c=color: spaet.logistic_chest(m, c), (1.25, 1.5), (0.5, 0.8 / 1.5),
                         (1.75, 1.75), (0.6 / 1.75, 0.6 / 1.75), frames=1, samples=36)
    for kind in ('construction', 'logistic'):
        name = f'robot.{kind}-robot'
        eisen.reset(samples=40, ground=False)
        root = spaet.robot(anlagen.Mats(), kind)
        root.location.z = 0.4
        eisen.camera(0.75, 0.75, anchor=(0.5, 0.5), target=(0, 0, 0.4))
        out.add(name, 'entities', [out.render_frame(name, 0)], (0.5, 0.5))
        eisen.reset(samples=24)
        root = spaet.robot(anlagen.Mats(), kind)
        root.location.z = 0.4
        eisen.shadow_render(out, f'{name}.shadow', 'entities', (1.0, 1.0), (0.5, 0.5))
