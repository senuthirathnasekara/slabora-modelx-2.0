export const HOUR = 3600000;
export const ZONE = 'Asia/Colombo';
export const DEFAULTS = Object.freeze({ duration: 3, startHour: 6, endHour: 18, measured: false, concrete: 30, rainLow: 30, rainHigh: 60, rainAmount: 1 });
export const STATES = {
  green: { label: 'Lower modeled risk', short: 'Lower risk', symbol: '✓', rank: 0 },
  amber: { label: 'Review conditions', short: 'Review', symbol: '!', rank: 1 },
  red: { label: 'Elevated concern', short: 'Elevated', symbol: '↑', rank: 2 },
  grey: { label: 'Cannot assess', short: 'Unavailable', symbol: '—', rank: 3 }
};
export const finite = x => typeof x === 'number' && Number.isFinite(x);
export const localDate = t => new Intl.DateTimeFormat('en-CA', {timeZone: ZONE, year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(t));
export const localHour = t => Number(new Intl.DateTimeFormat('en-GB', {timeZone: ZONE, hour:'2-digit', hourCycle:'h23'}).format(new Date(t)));
export const clock = t => new Intl.DateTimeFormat('en-GB', {timeZone: ZONE, hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(new Date(t));
export const day = t => new Intl.DateTimeFormat('en-GB', {timeZone: ZONE, weekday:'short', day:'numeric', month:'short'}).format(new Date(t));

export function validateSettings(s) {
  if (!Number.isInteger(s.duration) || s.duration < 1 || s.duration > 6) throw new Error('Review period must be between 1 and 6 hours.');
  if (!Number.isInteger(s.startHour) || !Number.isInteger(s.endHour) || s.startHour < 0 || s.endHour > 24 || s.startHour >= s.endHour) throw new Error('Workday start must be earlier than its end.');
  if (s.measured && (!finite(s.concrete) || s.concrete < 0 || s.concrete > 70)) throw new Error('Enter a concrete reading between 0 and 70 °C.');
  if (!finite(s.rainLow) || !finite(s.rainHigh) || s.rainLow < 1 || s.rainLow >= s.rainHigh || s.rainHigh > 100) throw new Error('Rain probability screens must satisfy 1 ≤ lower < upper ≤ 100%.');
  if (!finite(s.rainAmount) || s.rainAmount < 0.1 || s.rainAmount > 20) throw new Error('Rain amount screen must be between 0.1 and 20 mm.');
  return s;
}

export function evaporation(ta, tc, rh, v) {
  if (![ta,tc,rh,v].every(finite) || ta <= -18 || tc <= -18 || rh < 0 || rh > 100 || v < 0) return null;
  return Math.max(0, 5e-6 * ((tc + 18) ** 2.5 - (rh / 100) * (ta + 18) ** 2.5) * (v + 4));
}

// Instant readings at t; preceding-hour gust, rain and probability at t+1.
// Every row represents the interval [time, time + 1 hour).
export function hourlyBins(data, settings, now = Date.now()) {
  validateSettings(settings);
  const all = data?.rows || [];
  const next = new Map(all.map(r => [r.time, r]));
  return all.filter(r => r.time >= now && r.time < now + 48 * HOUR).map(r => {
    const end = next.get(r.time + HOUR);
    const values = [r.temp,r.humidity,r.wind,end?.gust,end?.prob,end?.rain];
    const valid = values.every(finite) && r.temp > -18 && r.humidity >= 0 && r.humidity <= 100 && r.wind >= 0 && end.gust >= 0 && end.prob >= 0 && end.prob <= 100 && end.rain >= 0;
    const temperatures = settings.measured ? [settings.concrete] : [r.temp, r.temp + 5, r.temp + 10];
    const cases = valid ? temperatures.flatMap((tc,i) => [
      {label: settings.measured ? 'Measured Tc · baseline wind' : `Ta${i ? ` + ${i*5}°C` : ''} · baseline wind`,tc,wind:r.wind*.65,value:evaporation(r.temp,tc,r.humidity,r.wind*.65)},
      {label: settings.measured ? 'Measured Tc · gust stress' : `Ta${i ? ` + ${i*5}°C` : ''} · gust stress`,tc,wind:end.gust*.65,value:evaporation(r.temp,tc,r.humidity,end.gust*.65)}
    ]) : [];
    return {...r,gust:end?.gust ?? null,prob:end?.prob ?? null,rain:end?.rain ?? null,valid:valid && cases.every(c=>finite(c.value)),cases,min:cases.length?Math.min(...cases.map(c=>c.value)):null,max:cases.length?Math.max(...cases.map(c=>c.value)):null};
  });
}

export function classify(max, probability, amount, s) {
  if (![max,probability,amount].every(finite)) return 'grey';
  if (max >= 1 || probability >= s.rainHigh || amount >= s.rainAmount) return 'red';
  if (max < .5 && probability < s.rainLow && amount === 0) return 'green';
  return 'amber';
}

export function assessWindow(bins, start, s, data, now = Date.now()) {
  validateSettings(s);
  const end = start + s.duration * HOUR;
  const rows = Array.from({length:s.duration},(_,i)=>bins.find(b=>b.time === start + i * HOUR));
  const invalid = rows.length !== s.duration || rows.some(r=>!r?.valid);
  const stale = !finite(data?.fetchedAt) || now - data.fetchedAt > 3*HOUR || data.fetchedAt > now + 60000;
  const complete = !invalid;
  const max = complete ? Math.max(...rows.map(r=>r.max)) : null;
  const min = complete ? Math.min(...rows.map(r=>r.min)) : null;
  const probability = complete ? Math.max(...rows.map(r=>r.prob)) : null;
  const rain = complete ? rows.reduce((total,r)=>total+r.rain,0) : null;
  const status = invalid || stale ? 'grey' : classify(max,probability,rain,s);
  const reasons = [];
  if (invalid) reasons.push('A complete review period with every required weather input is unavailable.');
  if (stale) reasons.push('Forecast is older than 3 hours, or its retrieval timestamp is invalid. Refresh before reviewing.');
  if (!invalid) {
    if (max >= 1) reasons.push(`A tested scenario reaches ${max.toFixed(2)} kg/m²/h, at or above the 1.0 upper evaporation screen.`);
    else if (max >= .5) reasons.push(`A tested scenario reaches ${max.toFixed(2)} kg/m²/h, crossing the 0.5 lower evaporation screen.`);
    else reasons.push('Every tested temperature and wind scenario remains below 0.5 kg/m²/h.');
    if (rain > 0 || probability >= s.rainLow) reasons.push(`Forecast rain exposure: ${rain.toFixed(1)} mm total and up to ${probability}% hourly probability in this period.`);
    else reasons.push(`No forecast accumulation; maximum hourly rain probability is ${probability}%.`);
  }
  return {start,end,rows:rows.filter(Boolean),max,min,probability,rain,status,reasons,stale};
}

export function rankWindows(bins,s,data,now=Date.now(),date='all') {
  return bins.filter(b => localHour(b.time)>=s.startHour && localHour(b.time)+s.duration<=s.endHour && (date==='all'||localDate(b.time)===date))
    .map(b=>assessWindow(bins,b.time,s,data,now))
    .sort((a,b)=>STATES[a.status].rank-STATES[b.status].rank || (a.max??Infinity)-(b.max??Infinity) || (a.probability??Infinity)-(b.probability??Infinity) || (a.rain??Infinity)-(b.rain??Infinity) || a.start-b.start);
}

export function csvText(windows,data,location,settings) {
  const headers=['mode','source','location','latitude','longitude','timezone','fetched_at','start','end','status','max_evaporation_kg_m2_h','min_evaporation_kg_m2_h','max_rain_probability_pct','total_rain_mm','assumptions','settings','reasons'];
  const escape=v=>'"'+String(v??'').replace(/^[=+@-]/,'\'$&').replaceAll('"','""')+'"';
  const values=windows.map(w=>[data.mode,data.mode==='sample'?'Synthetic illustration':'Open-Meteo',location.name,location.lat,location.lon,ZONE,new Date(data.fetchedAt).toISOString(),new Date(w.start+19800000).toISOString().replace('Z','+05:30'),new Date(w.end+19800000).toISOString().replace('Z','+05:30'),STATES[w.status].label,w.max,w.min,w.probability,w.rain,settings.measured?`User supplied Tc=${settings.concrete}°C; 0.65×10m wind and gust stress`:'Tc=Ta/Ta+5/Ta+10°C; 0.65×10m wind and gust stress',JSON.stringify(settings),w.reasons.join(' ')]);
  return [headers,...values].map(row=>row.map(escape).join(',')).join('\r\n');
}
