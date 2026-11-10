# Slabora - Two-Page Implementation Summary

Team Astrova | 10 November 2026

## Slabora: implementation summary

Team Astrova | ModelX 2.0 | 10 November 2026

### The problem and delivered system

Small builders need to compare pour times using weather, while concrete-surface temperature and local wind are uncertain. Slabora is a working browser prototype that turns hourly forecasts into ranked candidate windows with explicit assumptions and reasons. It supports planning; it does not approve structural work or predict actual cracks.

The app offers four Sri Lankan town presets and bounded custom coordinates, live Open-Meteo retrieval, 48 future hourly intervals, 1-6 hour review periods, workday settings, scenario/rain charts, an hourly table and CSV export. Overview, Pour planner and How it works form the complete workflow. The supplied navy palette uses restrained green accents; statuses also have text labels.

### Architecture and stack

| Module | Role |
| --- | --- |
| weather.js | Fetch and validate the hourly forecast; explicit synthetic sample mode. |
| core.js | Scenario construction, evaporation, interval assessment, ranking and export. |
| app.js / styles.css | Browser state, interactions, SVG charts, errors and responsive presentation. |
| tests / evidence / scripts | 29 tests, real provider snapshots and repeatable evidence replay. |

The final stack is HTML, CSS and dependency-free JavaScript ES modules, rather than the proposed Python/Streamlit application. It needs no backend, database, API key or compilation. Node built-in tests verify the core. The change simplifies static hosting but requires custom UI/chart code. Forecasts remain in memory; only settings persist locally. No persistent cache was added.

### Method and decision boundaries

E = max(0, 5 × 10^-6 × [(Tc+18)^2.5 - (RH/100) × (Ta+18)^2.5] × (V+4)). E is kg/m²/h, temperatures °C, RH percent and near-surface V km/h.

Without a concrete reading, three Tc assumptions (Ta, Ta+5, Ta+10°C) combine with mean-wind and gust cases, each scaled by 0.65. The result is six scenarios per hour, not a calibrated confidence interval. Each complete candidate uses the maximum evaporation and rain probability plus total rain accumulation across its review period.

Default lower-risk status requires every E <0.5, rain probability <30%, and zero rain. Elevated concern starts at E ≥1.0, probability ≥60%, or accumulation ≥1 mm; other assessable cases require review. Invalid/missing inputs, incomplete periods and retrieval age over three hours return Cannot assess. These screens are prototype rules, not guarantees of concrete performance.

## Evidence, gaps and reproducibility

### Final data and its temporality

Open-Meteo provides temperature and humidity at 2 m, mean wind and gusts at 10 m, rain probability and accumulation. The request covers four calendar days to support the next 48 hourly starts plus the endpoint. All UI times use Asia/Colombo (UTC+05:30). For [t,t+1h), instantaneous inputs use t; preceding-hour rain, probability and gust inputs use t+1h. Retrieval time is recorded; it is not the provider model-issuance time.

A real response saved on 10 November 2026 at 16:42:12 UTC returned HTTP 200 and 96 hourly rows. The production model produced 48 valid future intervals and 20 candidates: 4 review, 16 elevated and no lower-risk window. The top candidate was 11 November 06:00-09:00 local time, E 0.6612 kg/m²/h, maximum rain probability 6% and rain 0 mm. These are frozen forecast results, not observations or current recommendations.

### Honest evaluation against the proposal

| Completed | Not yet demonstrated |
| --- | --- |
| 29 tests passed; zero failures. Formula gold values, thresholds, scenario sensitivity, missing/stale cases, interval alignment and export are checked. | Forecast-error MAE, rainfall calibration, historical backtesting and comparison with a weather-only baseline. |
| Live-data integration and development walkthroughs of settings, charts, mobile layout, export and errors. | The planned 3-5 external-user study, construction-specialist validation and any field-outcome evaluation. |
| Transparent scenario-aware planning and reproducible source/evidence. | Predictive superiority, actual crack prevention, financial savings or a trained ML model. |

Key gaps include concrete-surface temperature, site-level wind/shielding, solar effects, mix and bleeding behavior, curing/protection and observed outcomes. Temperature offsets and the wind-height conversion are assumptions. Forecast-grid mismatch, changing forecasts and subjective pilot thresholds limit the output. Frozen evidence never substitutes for live data in the app.

### Run and inspect

Run: python3 -m http.server 3000 --directory dist, then open http://localhost:3000. Windows may use py. Verify: npm test and npm run check. Replay the saved real response: node scripts/replay-evidence.mjs. README explains setup; the full technical report and evidence files are included in the repository.

### Attribution and assistance

Weather data by Open-Meteo, CC BY 4.0; API access is subject to its terms. Data/interval definitions: https://open-meteo.com/en/docs ; terms: https://open-meteo.com/en/terms. The equation and assumptions follow the team-confirmed Phase 1 proposal and its cited Uno/ACI background. ChatGPT/Codex assisted with implementation, tests and documentation; Team Astrova must review and understand the submission. The next steps are expert review, explicit baseline/forecast evaluation and the planned user walkthroughs.
