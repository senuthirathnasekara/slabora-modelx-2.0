// Frozen real-provider evidence replay, NOT a current forecast or runtime fallback.
import fs from 'node:fs';
import {parseForecast} from '../dist/weather.js';
import {DEFAULTS,hourlyBins,rankWindows,csvText} from '../dist/core.js';
const root = new URL('../', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const meta = read('evidence/retrieval-metadata.json');
const raw = read('evidence/openmeteo-colombo-2026-11-10.json');
const now = Date.parse(meta.retrieved_at_utc);
if (!Number.isFinite(now)) throw new Error('Missing capture time');
const data = parseForecast(raw,now);
const bins = hourlyBins(data,DEFAULTS,now);
const windows = rankWindows(bins,DEFAULTS,data,now);
if (data.rows.length!==96 || bins.length!==48 || bins.some(b=>!b.valid)) throw new Error('Evidence completeness differs from report');
const top=windows[0];
const result={
  evaluation:'Frozen forecast replay at recorded retrieval time; not a live recommendation',
  retrieved_at_utc:meta.retrieved_at_utc,
  http_status:meta.http_status,
  provider_rows:data.rows.length,
  valid_future_hourly_bins:bins.filter(b=>b.valid).length,
  candidates:windows.length,
  states:windows.reduce((a,w)=>(a[w.status]=(a[w.status]||0)+1,a),{}),
  top_candidate:top?{start_utc:new Date(top.start).toISOString(),status:top.status,max_evaporation_kg_m2_h:top.max,max_hourly_rain_probability_percent:top.probability,rain_mm:top.rain}:null
};
fs.writeFileSync(new URL('evidence/replay-results.json',root),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(new URL('evidence/candidates-frozen-2026-11-10.csv',root),csvText(windows,data,{name:'Colombo - frozen 2026-11-10 evidence',lat:6.9271,lon:79.8612},DEFAULTS));
console.log(JSON.stringify(result,null,2));
