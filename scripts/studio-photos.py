"""Re-shoot the demo photos in Kasra's studio: cut each model out of her original backdrop and stand her on the
storefront's own studio gray (--color-studio, #EAECF0) with a soft floor shadow, so a photo and the panel around it
are one surface. Also writes the head-and-shoulders crops for the collection circles.

The photos are AI-generated demo imagery, not pictures of real stock. Nothing is upscaled: every output keeps its
source's pixel size (the portraits are crops of it).

Usage (rembg's BiRefNet portrait model does the cut-out; it downloads about 1GB on first use):
    python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" pillow numpy
    .venv/bin/python scripts/studio-photos.py SOURCE_DIR public/images

SOURCE_DIR holds the originals in the same layout as public/images (lookbook/*.avif, brand-preview/hero-model.avif).
They are the files as of commit 381c640: git archive 381c640 public/images/lookbook public/images/brand-preview.
"""

import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

STUDIO = np.array([234, 236, 240], dtype=np.float32) / 255  # --color-studio
SHADOW = np.array([118, 123, 133], dtype=np.float32) / 255  # the floor's shade under the feet
LOOKS = ['shomiz-cream', 'shomiz-rose', 'manto-black', 'manto-sage', 'tshirt-blue', 'tshirt-white']
PORTRAITS = ['shomiz-rose', 'manto-sage', 'tshirt-blue']  # the collection circles
PORTRAIT_SIZE = 200


def box_blur(a: np.ndarray, r: int) -> np.ndarray:
    """Three box blurs of radius r along both axes: close enough to a Gaussian, and needs only numpy."""
    for _ in range(3):
        for axis in (0, 1):
            pad = [(0, 0)] * a.ndim
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis)
            n = a.shape[axis]
            a = (np.take(c, range(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, range(0, n), axis=axis)) / (2 * r + 1)
    return a


def cut_out(image: Image.Image, session) -> tuple[np.ndarray, np.ndarray]:
    """The model's colors with the old backdrop taken out of her edges (hair, sleeves), and her alpha."""
    rgb = np.asarray(image, dtype=np.float32) / 255
    alpha = np.asarray(remove(image, session=session, only_mask=True), dtype=np.float32)[..., None] / 255
    # The backdrop behind each edge pixel, estimated from nearby pure-backdrop pixels.
    clear = (alpha < 0.04).astype(np.float32)
    backdrop = box_blur(rgb * clear, 14) / np.maximum(box_blur(clear, 14), 1e-4)
    # Edge pixels are a blend of model and backdrop: solve for the model's own color.
    fg = np.clip((rgb - (1 - alpha) * backdrop) / np.maximum(alpha, 0.04), 0, 1)
    return fg, alpha


def floor(alpha: np.ndarray) -> np.ndarray:
    """A contact shadow under the feet and a wider, fainter one around it; none when the feet are out of frame."""
    h, w = alpha.shape[:2]
    solid = alpha[..., 0] > 0.5
    rows = np.flatnonzero(solid.any(axis=1))
    shade = Image.new('L', (w, h), 0)
    if not len(rows) or solid[-2:].any():
        return np.zeros((h, w, 1), dtype=np.float32)
    bottom = rows[-1]
    cols = np.flatnonzero(solid[bottom - max(6, (bottom - rows[0]) // 25):bottom + 1].any(axis=0))
    cx, span = (cols[0] + cols[-1]) / 2, cols[-1] - cols[0]
    wide = Image.new('L', (w, h), 0)
    ImageDraw.Draw(wide).ellipse((cx - span * 1.25, bottom - 16, cx + span * 1.25, bottom + 16), fill=255)
    ImageDraw.Draw(shade).ellipse((cx - span * 0.7, bottom - 5, cx + span * 0.7, bottom + 6), fill=255)
    near = np.asarray(shade.filter(ImageFilter.GaussianBlur(6)), dtype=np.float32) / 255
    far = np.asarray(wide.filter(ImageFilter.GaussianBlur(18)), dtype=np.float32) / 255
    return np.clip(near * 0.42 + far * 0.16, 0, 1)[..., None]


def studio(fg: np.ndarray, alpha: np.ndarray) -> Image.Image:
    shadow = floor(alpha)
    ground = STUDIO * (1 - shadow) + SHADOW * shadow
    return Image.fromarray(np.round((fg * alpha + ground * (1 - alpha)) * 255).astype(np.uint8))


def portrait(photo: Image.Image, alpha: np.ndarray) -> Image.Image:
    """A square from just above her head to mid-chest, centred on her head."""
    solid = alpha[..., 0] > 0.5
    top = np.flatnonzero(solid.any(axis=1))[0]
    head = np.flatnonzero(solid[top:top + 40].any(axis=0))
    cx = int(round((head[0] + head[-1]) / 2))
    left = min(max(cx - PORTRAIT_SIZE // 2, 0), photo.width - PORTRAIT_SIZE)
    upper = max(top - 14, 0)
    return photo.crop((left, upper, left + PORTRAIT_SIZE, upper + PORTRAIT_SIZE))


def save(image: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    # 4:4:4 keeps the flat studio gray within a level of #EAECF0, so photo and panel meet without a seam.
    image.save(path, 'AVIF', quality=82, subsampling='4:4:4')
    print('wrote', path, image.size)


def main(source: Path, out: Path):
    # Without the arena, memory is handed back after each photo; with it, a 16GB machine runs out by the second.
    options = ort.SessionOptions()
    options.enable_cpu_mem_arena = False
    options.enable_mem_pattern = False
    session = new_session('birefnet-portrait', sess_opts=options)
    jobs = [('lookbook/' + look) for look in LOOKS] + ['brand-preview/hero-model']
    for name in jobs:
        image = Image.open(source / (name + '.avif')).convert('RGB')
        fg, alpha = cut_out(image, session)
        photo = studio(fg, alpha)
        save(photo, out / (name + '.avif'))
        look = name.split('/')[-1]
        if look in PORTRAITS:
            save(portrait(photo, alpha), out / 'lookbook' / (look + '-portrait.avif'))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
