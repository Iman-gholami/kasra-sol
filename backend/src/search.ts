export const normalizeSearch = (value: string) => value
  .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/\u200c/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
