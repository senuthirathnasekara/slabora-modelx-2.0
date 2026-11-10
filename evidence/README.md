# Evidence register

Team Astrova - Slabora - 10 November 2026.

| File | What it demonstrates | Limit |
| --- | --- | --- |
| `test-results-2026-11-10.txt` | Actual Node run: 29 tests passed, 0 failed | Checks software behavior, not predictive accuracy |
| `syntax-check-2026-11-10.txt` | All three application JS modules parse | Does not replace browser testing |
| `openmeteo-colombo-2026-11-10.json` | Actual HTTP 200 provider response, 96 hourly rows | Frozen grid forecast, not observations |
| `retrieval-metadata.json` | Request URL and actual 2026-11-10T16:42:12.010393+00:00 retrieval time | Retrieval is not the underlying model issuance time |
| `replay-results.json` | Saved response through the production parser and model at capture time | Reproducibility, not a new forecast |
| `candidates-frozen-2026-11-10.csv` | Auditable candidate export from that replay | Must not be used for current decisions |
| `../tests/fixtures/openmeteo-colombo-2026-11-04.json` | Earlier real provider snapshot supplied with source | Exact retrieval time is not embedded in that fixture |

Reproduce: `node scripts/replay-evidence.mjs`. It fixes the assessment clock at the captured retrieval time and writes the two replay files. It does not bypass freshness checks in the application.

On 10 November at 16:42:12 UTC (22:12:12 in Sri Lanka), the 96 provider rows yielded 48 valid future intervals. Default 06:00-18:00 workday and three-hour duration yielded 20 candidates: 4 review, 16 elevated, 0 lower-risk. The top candidate was 11 November 06:00-09:00 Asia/Colombo, with conservative evaporation 0.6612 kg/m²/h, maximum hourly rain probability 6%, and 0 mm accumulation. These values describe this snapshot only; the live app will change as forecasts and time change.

Earlier development browser checks covered live retrieval, settings/re-ranking, reset, navigation, chart tabs, explicit sample labels, CSV download, hourly table and a narrow mobile layout. Those checks are reported separately from the 29 automated tests. No recordings of those checks are included, and no formal external-user study has been completed.

Weather data: Open-Meteo, CC BY 4.0. See https://open-meteo.com/en/docs and https://open-meteo.com/en/terms.
