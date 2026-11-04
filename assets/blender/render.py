"""Einstieg für die Pipeline: blender -b --factory-startup -P assets/blender/render.py -- --model belt --out DIR"""
import importlib.util
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'lib'))
sys.path.insert(0, os.path.join(HERE, 'lib', 'gartenwerk'))

import bpy  # noqa: E402,F401  (bpy vor bmesh laden)
import eisen  # noqa: E402


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    args = dict(zip(argv[::2], argv[1::2]))
    model = args['--model']
    out = args['--out']
    spec = importlib.util.spec_from_file_location(model, os.path.join(HERE, 'models', f'{model}.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    t0 = time.time()
    o = eisen.Output(out)
    mod.render(o)
    o.finish()
    print(f'[eisenwerk] Modell {model}: {sum(len(s.get("frames", [])) or s.get("cols", 1) * s.get("rows", 1) for s in o.sprites)} Sprites in {time.time() - t0:.1f} s')


main()
