"""Create a shoreline-aware water mask and derived, fading lake reflection."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
source = Image.open(ROOT / 'assets/landscape-master.png').convert('RGB')
w, h = source.size

# Image coordinates match the painting's normalized UVs. The shore follows the
# natural inlet; carved cutouts preserve the foreground rocks, reeds and tree.
shore = [
    (0.0, .716), (.06, .729), (.14, .738), (.22, .728), (.30, .714),
    (.37, .695), (.43, .667), (.48, .625), (.51, .618), (.55, .638),
    (.61, .652), (.68, .652), (.74, .664), (.81, .686), (.88, .684),
    (.93, .665), (.968, .655), (1.0, .657),
]
mask = Image.new('L', (w, h), 0)
d = ImageDraw.Draw(mask)
d.polygon([(round(x*w), round(y*h)) for x, y in shore] + [(w, h), (0, h)], fill=255)
# Foreground stones/reeds near the lower-left and the framing tree at far right.
d.polygon([(0, .885*h), (.06*w, .89*h), (.13*w, .93*h), (.21*w, .91*h),
           (.31*w, .955*h), (.38*w, h), (0, h)], fill=0)
d.polygon([(.963*w, .75*h), (1.0*w, .745*h), (w, h), (.975*w, h)], fill=0)
# Keep the fishing boat, including its oars and tiny figure, outside the water shader.
d.polygon([(.653*w, .675*h), (.761*w, .675*h), (.766*w, .744*h), (.649*w, .744*h)], fill=0)
mask.save(ROOT / 'assets/water-mask.png', optimize=True)

# The reference-inspired painting intentionally contains no old reflections.
# Reflect the ink scene at the changing shoreline and let the reflection dissolve.
pixels = np.asarray(source)
matte = np.asarray(mask)
y_grid, x_grid = np.mgrid[0:h, 0:w].astype(np.float32)
shore_samples = np.array(shore, dtype=np.float32)
shore_px = np.interp(x_grid[0], shore_samples[:, 0] * w, shore_samples[:, 1] * h)
source_y = np.rint(np.clip(2 * shore_px[None, :] - y_grid, 0, h - 1)).astype(np.int32)
source_y = np.broadcast_to(source_y, (h, w))
reflected = pixels[source_y, np.broadcast_to(np.arange(w)[None, :], (h, w))].copy()
depth = y_grid - shore_px[None, :]
fade = np.clip(1 - depth / (h * .21), 0, 1) ** 1.7
ink = np.max(255 - reflected, axis=2) / 255
alpha = (matte * fade * np.clip((ink - .015) * 1.9, 0, .32)).astype(np.uint8)
rgba = Image.fromarray(np.dstack((reflected, alpha)), 'RGBA')
rgba.save(ROOT / 'assets/reflection.png', optimize=True)

# Make the navigational layer fast to download while retaining the original master.
preview = source.resize((1536, 864), Image.Resampling.LANCZOS)
preview.save(ROOT / 'assets/landscape.webp', 'WEBP', quality=88, method=6)

print(f'landscape={w}x{h}, water pixels={(matte > 220).sum()}, reflection coverage={(alpha > 0).sum()}')
