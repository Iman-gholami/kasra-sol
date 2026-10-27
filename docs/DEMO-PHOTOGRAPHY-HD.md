# Demo photography: one studio

The demo storefront's photos are AI-generated sample imagery of one model, **not pictures of real stock**. Product
pages and the home page say so. Before launch, replace them with real photographs of every SKU (correct colors, model
approvals).

## Why they were re-shot

The photos came from two sources with different backdrops: the mockup cover portrait (cool gray studio with a white
block) and the lookbook (warm sand). Feathered into the storefront's cool-gray rooms, the sand bled into the gray, and
the category rooms, circles and product cards enlarged 94×94 crops of the mockup, rings included, to 300px and more.

`scripts/studio-photos.py` now cuts each model out of her backdrop (rembg, BiRefNet portrait model), takes the old
backdrop's tint out of her edges, and stands her on the storefront's studio gray `--color-studio` (#EAECF0) with a
soft floor shadow. A photo in a gray room therefore needs no mask or frame: its edges disappear. Nothing is upscaled;
every file keeps its source's pixel size.

| File | Size | Used for |
| --- | --- | --- |
| `brand-preview/hero-model.avif` | 458×597 | Home cover in demo mode |
| `lookbook/{shomiz-cream,shomiz-rose,manto-sage,manto-black,tshirt-blue}.avif` | 480×640 | Product cards and galleries, week of looks, category menu, closing room |
| `lookbook/tshirt-white.avif` | 450×600 | The same |
| `lookbook/{shomiz-rose,manto-sage,tshirt-blue}-portrait.avif` | 200×200 | Collection circles |

The lookbook files keep their names, so products that already reference them in the database pick up the new photos
with no data change. The five 94×94 mockup crops were deleted; `tests-unit/products-data.test.ts` fails if a demo photo
smaller than its slot comes back.

## Re-running

The originals are the files as of commit `381c640`:

```sh
mkdir -p /tmp/originals && git archive 381c640 public/images/lookbook public/images/brand-preview | tar -x -C /tmp/originals
python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" pillow numpy
.venv/bin/python scripts/studio-photos.py /tmp/originals/public/images public/images
```

The first run downloads the BiRefNet model (about 1GB). If `--color-studio` changes, change `STUDIO` in the script to
match and re-run it.

Uploaded product photos are never touched: the home cover shows them as a framed plate instead of standing them in
the room.
