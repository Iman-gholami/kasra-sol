# Estedad variable webfont

This directory contains a locally vendored official variable font, used for the Persian UI of Kasra Boutique.

- Typeface: [Estedad](https://github.com/aminabedi68/Estedad), by Amin Abedi / Fontamin.
- Pinned stable version: [8.5](https://github.com/aminabedi68/Estedad/releases/tag/8.5).
- Upstream commit: `97d10596b3a260c040336199c2e83a6305d37663`.
- Upstream binary: `fonts/Estedad[wght].woff2` (Git blob SHA `01db924b1aa7dea3ab62814d50e73440957df7d3`, 120,924 bytes).
- License: [SIL Open Font License 1.1](OFL.txt).
- Source font is the official upstream binary, not a modified build.
- Next.js loads `Estedad-VF.woff2` locally with variable weights 100–900. Latin editorial wordmark remains a deliberate serif brand mark.

The `vendor-estedad-font.yml` GitHub Action reproduces the download and checks its exact upstream Git object hash; **do not replace this asset with a different version without updating and validating its provenance**.

# Amiri display subset

`Amiri-Regular-fa.woff2` is the display face for large editorial headings (28px and up); all UI text, prices and forms stay in Estedad.

- Typeface: [Amiri](https://github.com/aliftype/amiri), by Khaled Hosny / the Amiri Project Authors, version 1.002.
- Source: npm package `@fontsource/amiri` 5.3.0, file `files/amiri-arabic-400-normal.woff2` (108,560 bytes, SHA-256 `9abf8a10b4a2f27b698740522c9beec9ded7728aeef0738ac0d6e175bf6249d7`).
- License: [SIL Open Font License 1.1](Amiri-OFL.txt). No Reserved Font Name is declared, so the subset keeps the family name.
- Subset with fontTools 4.67 to the Arabic letters, marks and punctuation Persian uses, Persian digits and separators, and ZWNJ/ZWJ, keeping every OpenType layout feature (joining, ligatures, mark positioning):

  ```sh
  pyftsubset amiri-arabic-400-normal.woff2 --layout-features='*' --flavor=woff2 \
    --output-file=Amiri-Regular-fa.woff2 \
    --unicodes="U+0020,U+00A0,U+00AB,U+00BB,U+060C,U+061B,U+061F,U+0621-063A,U+0640-064A,U+064B-0652,U+0654,U+066A-066C,U+0670,U+067E,U+0686,U+0698,U+06A9,U+06AF,U+06C0,U+06CC,U+06F0-06F9,U+200C-200F,U+2010-2014"
  ```

  Result: 41,976 bytes, SHA-256 `5ae2646eeba1457374f8615d83b2c069de9c9170c5002c39687abc3b2e4e743d`. Latin letters and Latin punctuation are not in the subset and fall back to Estedad.
