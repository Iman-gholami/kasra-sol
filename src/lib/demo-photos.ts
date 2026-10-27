/** Folders of the demo storefront's sample photos, which are not pictures of the actual items: the crops of the
 * approved mockup, and the earlier lookbook kept for rollback. Product pages label such photos as demo imagery.
 * Kept apart from src/data/products.ts so client components can use it without bundling the demo catalog. */
const DEMO_PHOTO = /^\/images\/(brand-preview|lookbook)\//;

export const isDemoPhoto = (src: string) => DEMO_PHOTO.test(src);
