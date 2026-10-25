# Kasra Palette B — image background variants

Six local AI-generated sample AVIF photographs are reused throughout the demo storefront. Source photos are kept unchanged; on every `npm run dev` and `npm run build`, `scripts/normalize-lookbook.mjs` generates 12 WebP variants under `public/images/lookbook-brand/`.

- Product cards, product gallery and category thumbnail circles: **#F7F8F9**
- Hero slides, category collection rooms and editorial banners: **#EAECF0**

The process samples the original studio color from four corners, flood-fills similar-color areas connected to image edges, and lightly feathers the model's contour. It preserves original garment texture, color and facial pixels not connected to the background. A small percentage of the original backdrop shading remains to prevent a flat cutout. If the mask size is unsafe, it conservatively converts without recoloring.

This workflow is only for six bundled demo photos. Backend/owner-uploaded product photographs are **not** modified. Before merging, visually inspect very pale fabrics, loose hair, and shadow transitions across desktop and mobile. The generated WebP files are ignored by git; originals can be restored without loss.
