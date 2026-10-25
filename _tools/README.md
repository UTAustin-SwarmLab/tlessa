# T-LESSA project page

This repo (`UTAustin-SwarmLab/tlessa`, branch `main`) is the project page,
built on the lab's Nerfies template like VSeek, CrossView and NeuS-QA. It is
served by GitHub Pages at https://utaustin-swarmlab.github.io/tlessa/.
The code repo `UTAustin-SwarmLab/T-LESSA` is still private, and the org's
free plan cannot serve Pages from a private repo, so the page lives here.
Jekyll skips this `_tools/` folder, so it is not published.

## Rebuild the video gallery

```bash
python3 _tools/build_gallery.py ".../DPAG/supplementary_20260925"
```

It remuxes the supplementary clips into `static/videos/` (no re-encode),
writes first-frame posters to `static/posters/`, and regenerates
`static/js/gallery-data.js`. The "Selected examples" tab is the manifest's
curated addendum (40 pairs). The "Unfiltered sample" tab is the rule-selected
sample (records before index 252), without the Wan `tlessa_phase` ablation arm.

## Paper PDF

`static/pdf/tlessa.pdf` is the AFRL-cleared public-release build (Approved for
Public Release on 21 Oct 2026; Distribution Unlimited; Case Number:
AFRL-2026-4443). Its text matches the ICLR submission 46264 plus the author
block, acknowledgment and release footer. Replace it only with a version
covered by a public-release clearance.

## Still to do

1. arXiv: add an arXiv button next to "Paper" and the arXiv id to the BibTeX
   (both marked TODO in `index.html`).
2. Code and TLVBench buttons say "coming soon". Once `UTAustin-SwarmLab/T-LESSA`
   is public, link it and its `supplementary/tlvbench_specs` folder (marked TODO).
3. Add T-LESSA to the "More Research" menu of the other lab pages and to the
   lab website.

Preview locally with `python3 -m http.server` from this folder. Safari will not
play the videos if `index.html` is opened directly from disk.
