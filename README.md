# Neuro App CHSC

Acute stroke assessment toolkit — two manual scoring aids in one offline-capable web app.

1. **ASPECTS** — camera-assisted Alberta Stroke Program Early CT Score. Photograph the CT film or monitor, rectify the slice, adjust window/level, then mark the 10 regions yourself. The app does the arithmetic, the interpretation text and the report.
2. **NIHSS** — the full 15-item NIH Stroke Scale with verbatim item wording from the official NINDS scale (updated Feb 2024), running total, severity band and printable worksheet.

**Not a medical device. No regulatory clearance. No automated image interpretation.** Every finding is entered by a trained clinician. Nothing is uploaded — all image processing happens on the device.

---

## Why the CT step is manual (and must stay manual)

A photograph of a film loses Hounsfield units. Early ischaemic change in ASPECTS is a 2–4 HU drop in attenuation — that signal does not survive a phone camera's JPEG pipeline, so automatic region scoring from a film photo is not viable. The app therefore does the things a phone genuinely can do well: geometric rectification, contrast enhancement, region bookkeeping, arithmetic and documentation.

For reference on what dedicated cleared software achieves on native DICOM (not photos): Brainomix e-ASPECTS reported 68% sensitivity / 97% specificity in its [510(k) summary](https://fda.innolitics.com/device/K221564), 69% agreement within one point in [external validation](https://www.brainomix.com/media/khyphyna/annals-of-neurology-2022-mair-external-validation-of-e-aspects-software-for-interpreting-brain-ct-in-stroke.pdf), and higher accuracy in a [more recent real-world cohort](https://pmc.ncbi.nlm.nih.gov/articles/PMC12738961/).

## Photograph quality gate

Every captured or chosen image is graded on six technical checks before scoring is allowed to continue. These describe the photograph only — they never look for ischaemia.

| Check | Good | Warn |
| --- | --- | --- |
| Resolution (short side) | ≥ 900 px | ≥ 600 px |
| Sharpness (variance of Laplacian) | ≥ 400 | ≥ 140 |
| Dynamic range | p99−p1 ≥ 120 and SD ≥ 30 | range ≥ 70 |
| Exposure | < 6% blown, < 25% crushed | < 15% / < 45% |
| Glare (near-white tiles) | < 3% of frame | < 9% |
| Colour neutrality | cast < 0.06 | < 0.14 |

Any failed check → **poor** and a pop-up advising a retake with a better camera phone or a proper lightbox. Any warning → **borderline**, with the specific fix listed. All-clear → straight to alignment. The grade and the individual metrics are carried into the PNG, text and JSON reports so a reviewer can see the conditions the score was made under.

## Files

```
index.html              app shell, both tool panels, dialogs
style.css               design tokens, dark + light themes, responsive rules
app.js                  ASPECTS: capture, rectification, CLAHE, window/level, scoring, reports
nihss.js                NIHSS: 15 items, totals, bands, reports
manifest.webmanifest    PWA metadata
sw.js                   cache-first service worker (offline use)
vercel.json             camera permissions policy, cache headers
assets/                 background image derivatives, icons
```

## Run locally

```bash
python3 -m http.server 4173
# open http://localhost:4173
```

The camera needs a secure context, so `getUserMedia` works on `localhost` and on any HTTPS deployment. The "Choose photo" fallback works everywhere.

## Deploy to Vercel

**Option A — CLI**

```bash
npm i -g vercel
cd neuro-app-chsc
vercel        # preview
vercel --prod # production
```

**Option B — Git**

Push the folder to a GitHub repo, then in Vercel: New Project → import the repo → framework preset **Other** → leave build command and output directory empty → Deploy.

There is no build step; it is a static site. `vercel.json` already sets `Permissions-Policy: camera=(self)` and keeps `sw.js` uncached so updates propagate.

After deploying, open the URL on a phone and use **Add to Home Screen** — the service worker caches the shell so it runs with no network in a CT room.

## Suggested validation study before any clinical use

1. Two independent readers (one trainee, one consultant neuroradiologist or stroke physician) score 60–100 consecutive non-contrast CTs.
2. Each reads on the workstation (reference standard) and again via the app on a phone photo, order randomised, with a washout period.
3. Endpoints: intraclass correlation for the total score, weighted kappa per region, agreement on the treatment-relevant **<8 vs ≥8** dichotomy, and time-to-score.
4. Also report how often the quality gate flagged an image and whether flagged images had worse agreement — that is the evidence that the gate is doing useful work.
5. Register the protocol with your institutional ethics committee. If the app is ever positioned as informing treatment decisions rather than as a training and documentation aid, it becomes Software as a Medical Device and attracts CDSCO obligations in India.

## References

- ASPECTS scoring definition and the <8 vs ≥8 dichotomy — [MDCalc ASPECTS](https://www.mdcalc.com/calc/10046/alberta-stroke-program-early-ct-score-aspects)
- ASPECTS region set and critical review — [Frontiers in Neurology](https://www.frontiersin.org/journals/neurology/articles/10.3389/fneur.2016.00245/full)
- NIHSS item wording and administration rules — [official NINDS NIH Stroke Scale, updated Feb 2024](https://www.ninds.nih.gov/sites/default/files/documents/NIH-Stroke-Scale_updatedFeb2024_508.pdf)
- NIHSS calculator reference — [MDCalc NIHSS](https://www.mdcalc.com/calc/715/nih-stroke-scale-score-nihss)
- NIHSS severity strata (0 none · 1–4 minor · 5–15 moderate · 16–20 moderate to severe · 21–42 severe) — [PMC6950922](https://pmc.ncbi.nlm.nih.gov/articles/PMC6950922/)

Background photograph: Command Hospital (Southern Command), Pune.
