# Slabora

**Uncertainty-aware concrete pour-window planning** for Team Astrova's ModelX 2.0 project.

A complete responsive browser application using the supplied navy palette with restrained sage-green accents. It combines real hourly weather, a deterministic evaporation equation, explicit temperature/wind scenarios, and pilot rain screening. It requires no account, database, API key, package installation, or compilation.

## Implementation submission - 10 November 2026

- [Technical report](reports/Slabora_Technical_Report.pdf) and [editable report](reports/Slabora_Technical_Report.md)
- [Two-page summary](reports/Slabora_Two_Page_Summary.pdf)
- [Three-minute demo script](DEMO_SCRIPT.md)
- [Upload and submission steps](SUBMIT_NOW.md)
- [Verification evidence](evidence/README.md)

Team: **Astrova**. The implementation is evaluated against the team-confirmed `Slabora_ModelX2.0_Proposal - Team Astrova(1).pdf`. The original proposal is not republished here because it contains personal contact details.

## Run locally

Requirements: Python 3 for a local web server; Node.js 20+ for verification.

```sh
python3 -m http.server 3000 --directory dist
```

Open `http://localhost:3000`. Serve over HTTP rather than opening `index.html` directly, because the app uses browser ES modules.

```sh
npm test
npm run check
```

Both commands use Node's built-in tooling. There are no npm dependencies or build step. `dist/` is the ready-to-deploy application; upload its contents to any static HTTPS host. For Cloudflare Pages, select no framework, leave the build command empty, and set the output directory to `dist`.

## Included experience

- Overview with next-hour weather and an explicit planning outlook.
- Colombo, Kandy, Galle and Jaffna presets; validated custom Sri Lanka coordinates.
- Live Open-Meteo requests, refresh, retrieval timestamp, strict unit/schema validation and timeout handling.
- Next 48 hourly intervals, all displayed in Asia/Colombo (UTC+05:30).
- Configurable workday, 1–6 hour exposure period, measured concrete temperature or three temperature scenarios.
- Baseline and gust-stress wind cases; scenario envelopes, 24/48-hour charts and an accessible hourly table.
- Ranked candidate windows, selected-period explanations and detailed calculation scenarios.
- Editable pilot rain screens and CSV export with provenance, assumptions, settings, reasons and units.
- Explicit synthetic sample mode. It is never silently substituted for live data.
- Missing-data, incomplete-period and stale-data refusal states.
- Methodology/reference page, keyboard navigation and reduced-motion support.

Settings are stored in the current browser's local storage; site coordinates and forecasts are not persisted. Custom coordinates go directly to Open-Meteo to retrieve weather. Fonts are optionally loaded from Google Fonts; system fallbacks are provided.

## Architecture and implementation choice

| File | Responsibility |
| --- | --- |
| `dist/core.js` | Pure scenario calculation, screening, interval assessment, ranking, timezone formatting, CSV serialization |
| `dist/weather.js` | Forecast adapter, unit/schema validation, Sri Lanka location presets, explicit synthetic data |
| `dist/app.js` | Responsive interface, interaction state, SVG charts, controls, export and errors |
| `dist/styles.css` | Navy/sage design system, responsive layout, focus and reduced-motion rules |
| `tests/core.test.mjs` | Independent numeric cases and behavior tests |
| `tests/fixtures/` | Dated real provider response used as integration evidence, never loaded by the app |

The proposal suggested Python/Streamlit. This implementation uses dependency-free browser JavaScript ES modules, HTML, CSS and SVG, preserving the proposed calculation and decision-support scope in an easily hosted web project. It avoids a server process and dependency installation, at the cost of implementing interface state and charts directly. There is no trained ML model.

## Formula and interval semantics

```text
E = max(0, 5e-6 × [(Tc + 18)^2.5 − (RH/100) × (Ta + 18)^2.5] × (V + 4))
```

E is kg/m²/h; temperatures are °C; RH is percent; V is km/h near the surface. Surface wind is approximated as 0.65 × forecast 10 m wind. A separate stress case uses 0.65 × 10 m gust speed. Unknown concrete temperature uses Tc = Ta, Ta+5 and Ta+10°C. These offsets are uncalibrated sensitivity assumptions. A user reading replaces those temperature scenarios, but does not predict future surface temperature.

For each interval `[t,t+1h)`, air temperature, humidity and wind are sampled at `t`; gust maximum, precipitation and precipitation probability are read from the provider's timestamp `t+1h`, whose definitions refer to the preceding hour. The model is a discrete hourly approximation, not a continuous physical simulation. For a candidate `[start,end)`, every hourly interval must be present. The conservative evaporation estimate is the maximum across all intervals and every scenario; rain accumulation is summed, and rain probability is maximized, never summed.

The public request asks for four calendar days to ensure at least 48 future hourly intervals plus the endpoint needed for precipitation/gust alignment, even late in the day. Only the next 48 starts are considered. The chart's horizon selector controls the chart; the candidate list has its own date filter.

## Screening and ranking

| State | Default rule |
| --- | --- |
| Lower modeled risk | Every scenario E < 0.5, maximum hourly rain probability <30%, total accumulation exactly zero |
| Review conditions | Intermediate conditions not meeting another state |
| Elevated concern | Any scenario E ≥1.0, probability ≥60%, or accumulation ≥1 mm |
| Cannot assess | Any required input invalid/missing, incomplete period, or retrieval more than 3 hours old |

Rain screens are adjustable prototype rules, not engineering standards. Lower risk always requires zero accumulation. Candidate start and end must fit inside the selected working day. Rank order is lower, review, elevated, unavailable; ties use conservative evaporation, maximum rain probability, accumulated rain, then time. A scenario crossing a screening band prevents lower risk. Null values are never converted into zero.

## Verification

- **29 automated tests pass**: independently computed formula examples, evaporation/rain boundaries, six scenarios, measured input behavior, late-hour hazards, rain/gust interval alignment, missing fields, incomplete periods, stale/future timestamps, Sri Lanka midnight, workday constraints, ranking, API schema, location/settings validation, explicit sample provenance and CSV quoting.
- Independent formula gold values were computed separately using Python Decimal at 35-digit precision. Tests of the selected equation use a 1e-12 absolute tolerance; this is not a claim of physical forecast accuracy.
- A real Colombo API request returned all six required fields, explicit expected units, consecutive timestamps and the Asia/Colombo timezone on 4 November 2026. The frozen response in `tests/fixtures/openmeteo-colombo-2026-11-04.json` is historical integration evidence, not a current forecast or runtime fallback.
- A fresh response captured on 10 November 2026 at 16:42:12 UTC returned HTTP 200, 96 hourly rows and all six required fields. At that retrieval time the model produced 48 valid future hourly bins and 20 default-workday candidates: 4 review and 16 elevated, with no lower-risk window. The saved response, precise retrieval metadata and reproducible replay are in `evidence/`. They are frozen evidence, not a current forecast.
- Desktop browser checks cover live retrieval, scenario controls, re-ranking, settings reset, navigation, chart controls, explicit sample-mode labels, an actual CSV download, and all 48 hourly data rows. A 390 px embedded viewport was inspected: the page had no horizontal overflow, the chart scrolled independently, and mobile navigation retained accessible names.

There is no evidence of field validation, crack-prediction accuracy, financial savings or a trained ML model. Automated tests validate software behavior, not engineering suitability.

Reproduce the saved real-data calculation without network access:

```sh
node scripts/replay-evidence.mjs
```

Capture a new provider response and its actual retrieval metadata:

```sh
python3 scripts/capture-weather.py
```

To host this repository on GitHub Pages, use Settings > Pages > Deploy from a branch > main > /(root). The root `index.html` opens the app in `dist/`. Wait until GitHub reports the site is deployed, then test the provided URL while signed out. This repository does not contain a preset public deployment URL.

## Sources and attribution

- [Open-Meteo forecast documentation](https://open-meteo.com/en/docs), including preceding-hour precipitation, probability and gust definitions.
- [Open-Meteo terms](https://open-meteo.com/en/terms). Weather data attribution: Open-Meteo, CC BY 4.0. The public free endpoint is subject to non-commercial terms and usage limits.
- P. J. Uno, *Plastic Shrinkage Cracking and Evaporation Formulas*, ACI Materials Journal 95(4), 365–375 (1998).
- ACI Committee 305, *Guide to Hot Weather Concreting*, ACI 305R-20; consult current [ACI publications](https://www.concrete.org/store/).
- [ConcreteCounts equation and worked example](https://concretecounts.com/evaporation-rate-calculator/).
- User-supplied Slabora proposal by Team Astrova and palette image.
- [ModelX 2.0 competition brief](https://modelx2.pages.dev/).

## AI assistance disclosure

ChatGPT/Codex assisted with interpreting the supplied proposal, design, implementation, source review, tests and documentation. The team must review and understand the implementation, confirm competition requirements, disclose assistance in its submission, and obtain appropriate professional review before any operational use.

## Boundaries

Educational planning prototype. Forecast and model assumptions need on-site review; this is not structural approval. It does not replace the responsible professional, concrete supplier guidance, specifications, site observations, protection or curing practices. Rain probability is not a probability of slab damage. The open-terrain wind conversion and scenario offsets may not represent actual site conditions. There is no automatic ordering, authentication, server-side storage or background monitoring.
