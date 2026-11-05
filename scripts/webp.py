"""Atlas-Seiten (PNG) eines Ordners in WebP umwandeln und die Spritesheet-JSONs anpassen.
Aufruf: python3 scripts/webp.py <ordner> [qualität]"""
import json
import os
import sys

from PIL import Image

folder = sys.argv[1]
quality = int(sys.argv[2]) if len(sys.argv) > 2 else 88
for f in sorted(os.listdir(folder)):
    if not (f.startswith('atlas-') and f.endswith('.json')):
        continue
    jp = os.path.join(folder, f)
    j = json.load(open(jp))
    png = os.path.join(folder, j['meta']['image'])
    if not png.endswith('.png') or not os.path.exists(png):
        continue
    webp = png[:-4] + '.webp'
    Image.open(png).save(webp, 'WEBP', quality=quality, method=4, alpha_quality=90)
    os.remove(png)
    j['meta']['image'] = os.path.basename(webp)
    json.dump(j, open(jp, 'w'))
