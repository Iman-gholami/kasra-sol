# Exact image crops from the approved Kasra Boutique mockup

The user asked for **the exact photographs visible in the previously generated Kasra design image**, not unrelated stock imagery. Unsplash dependencies were removed entirely from the demo storefront.

Locally hosted files in `public/images/brand-preview/` are directly cropped from the generated mockups. They are **not newly generated people** and no color filters, automatic background segmentation, or image upscaling was used.

- `hero-model.avif` (458×597): same ivory-shirt model with gray studio blocks, used by the main demo hero and editorial panels.
- `shomiz-blue.avif` (94×94): same blue-shirt category portrait.
- `manto-cream.avif` (94×94): same cream coat category portrait.
- `manto-pink.avif` (94×94): same pink outerwear portrait.
- `tshirt-blue.avif` (94×94): same blue T-shirt portrait.
- `shomiz-cream.avif` (94×94): same light shirt category portrait.

The small category crops should be used at **thumbnail sizes**; enlarging them as product-gallery photography won't reveal genuine extra detail. Product images in this demo are visual samples only. Before launching, source real high-resolution apparel photography for every SKU, with correct colors and any necessary model approvals.

Six original local AVIF placeholders remain available in `public/images/lookbook/` for rollback. Backend-uploaded real product images are left unchanged. The data loader isolates local mockup photos to the demo catalog.
