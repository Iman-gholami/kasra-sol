# Estedad variable webfont

This directory contains a locally vendored official variable font, used for the Persian UI of Kasra Boutique.

- Typeface: [Estedad](https://github.com/aminabedi68/Estedad), by Amin Abedi / Fontamin.
- Pinned stable version: [8.5](https://github.com/aminabedi68/Estedad/releases/tag/8.5).
- Upstream commit: `97d10596b3a260c040336199c2e83a6305d37663`.
- Upstream binary: `fonts/Estedad[wght].woff2` (Git blob SHA `01db924b1aa7dea3ab62814d50e73440957df7d3`, 120,924 bytes).
- License: [SIL Open Font License 1.1](OFL.txt). The license names no Reserved Font Name, so a subset may keep the name.
- `Estedad-VF.woff2` is the official upstream binary, not a modified build. It is the verified source and is not
  served to visitors.
- Latin editorial wordmark remains a deliberate serif brand mark.

## Served file: `Estedad-VF-fa.woff2` (Persian subset)

Next.js loads `Estedad-VF-fa.woff2` with variable weights 100–900. It is derived from the verified file above and
keeps only what the storefront and back office render: Basic Latin and Latin-1, the Arabic block (Persian letters
and digits, Arabic punctuation), general punctuation including ZWNJ and bidi controls, arrows and ≤ ≥. All layout
features (joining forms, ligatures, `tnum` and the rest), hinting and vertical metrics are kept. 80,712 bytes
(Git blob SHA `93a5314f7ef00633d12a2f625405a645630ef66b`), 40 KB less than the full file on every first visit.

Regenerate it after any change to the source font, with fontTools 4.67.0 (plus `brotli`):

```sh
pyftsubset src/fonts/Estedad-VF.woff2 \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0600-06FF,U+200C-200F,U+2010-2027,U+202F-2044,U+2066-2069,U+2190-2193,U+2212,U+2264-2265,U+FEFF" \
  --layout-features='*' --flavor=woff2 --output-file=src/fonts/Estedad-VF-fa.woff2
```

If new copy uses a character outside these ranges, add its range here and regenerate; otherwise that character falls
back to a system font.

The `vendor-estedad-font.yml` GitHub Action reproduces the download and checks its exact upstream Git object hash; **do not replace this asset with a different version without updating and validating its provenance**.
