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
