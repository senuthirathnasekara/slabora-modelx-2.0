import test from 'node:test';
import assert from 'node:assert/strict';
import {HOUR,DEFAULTS,evaporation,validateSettings,hourlyBins,assessWindow,rankWindows,classify,localDate,localHour,clock,csvText} from '../dist/core.js';
import {FIELDS,parseForecast,validateLocation,sampleForecast} from '../dist/weather.js';

const start=Date.UTC(2026,0,1,0,30); // 06:00 Asia/Colombo
const now=start-1;
function data(n=8){return {mode:'live',fetchedAt:now,rows:Array.from({length:n},(_,i)=>({time:start+i*HOUR,temp:25,humidity:95,wind:1,gust:1,prob:5,rain:0}))};}
const s={...DEFAULTS};
function assess(d,settings=s,time=now){const bins=hourlyBins(d,settings,time);return assessWindow(bins,start,settings,d,time);}
function api(){return {timezone:'Asia/Colombo',hourly_units:{time:'unixtime',...Object.fromEntries(Object.entries(FIELDS).map(([k,[,unit]])=>[k,unit]))},hourly:{time:[start/1000,start/1000+3600],temperature_2m:[25,26],relative_humidity_2m:[95,90],wind_speed_10m:[1,2],wind_gusts_10m:[2,3],precipitation_probability:[5,8],precipitation:[0,0]}};}

test('metric equation agrees with three independently computed 35-digit Decimal examples',()=>{
  const examples=[[[30,30,50,10],.5586903084894170598],[[29.4444444444444,29.4444444444444,40,16.09344],.9346283774913557996],[[28,38,75,7.8],.7495429293509552302]];
  for(const [args,expected] of examples)assert.ok(Math.abs(evaporation(...args)-expected)<1e-12);
});
test('negative evaporation clamps to zero; invalid inputs do not coerce to zero',()=>{
  assert.equal(evaporation(35,20,100,3),0);
  for(const x of [null,undefined,NaN,Infinity,'50'])assert.equal(evaporation(30,30,x,10),null);
  for(const args of [[-18,30,50,1],[30,-19,50,1],[30,30,101,1],[30,30,50,-1]])assert.equal(evaporation(...args),null);
});
test('0.5 and 1.0 evaporation boundaries are conservative',()=>{
  assert.equal(classify(.499999,0,0,s),'green');assert.equal(classify(.5,0,0,s),'amber');assert.equal(classify(1,0,0,s),'red');
});
test('rain screens require strict probability and exactly zero accumulation for green',()=>{
  assert.equal(classify(.2,29,0,s),'green');assert.equal(classify(.2,30,0,s),'amber');assert.equal(classify(.2,60,0,s),'red');
  assert.equal(classify(.2,0,.01,s),'amber');assert.equal(classify(.2,0,1,s),'red');assert.equal(classify(null,0,0,s),'grey');
});
test('concrete and wind scenarios are evaluated as all six combinations',()=>{
  const bin=hourlyBins(data(),s,now)[0];assert.equal(bin.cases.length,6);
  assert.deepEqual([...new Set(bin.cases.map(c=>c.tc))],[25,30,35]);assert.equal(bin.cases[0].wind,.65);
});
test('measured concrete produces two wind scenarios and remains user supplied',()=>{
  const bin=hourlyBins(data(),{...s,measured:true,concrete:32},now)[0];assert.equal(bin.cases.length,2);assert.ok(bin.cases.every(c=>c.tc===32));
});
test('scenario warning crossing prevents green even when baseline case is low',()=>{
  const d=data();d.rows.forEach(r=>{r.temp=30;r.humidity=75;r.wind=7;r.gust=12;});const result=assess(d);
  assert.ok(result.rows[0].cases[0].value<.5);assert.ok(result.max>=.5);assert.notEqual(result.status,'green');
});
test('window checks later hours, not only the start hour',()=>{
  const d=data();d.rows[2].humidity=10;d.rows[3].gust=80;
  const result=assess(d);assert.equal(result.status,'red');assert.ok(result.max>1);
});
test('rain and probability at end timestamp belong to the preceding hour',()=>{
  const d=data();d.rows[0].rain=9;d.rows[0].prob=99;d.rows[3].rain=1;d.rows[3].prob=80;
  const result=assess(d);assert.equal(result.rain,1);assert.equal(result.probability,80);assert.equal(result.status,'red');
});
test('rain at the start timestamp describes a period outside the candidate',()=>{
  const d=data();d.rows[0].rain=9;d.rows[0].prob=100;const result=assess(d);
  assert.equal(result.rain,0);assert.equal(result.probability,5);assert.equal(result.status,'green');
});
test('gust maximum is aligned from the next timestamp, including last exposure hour',()=>{
  const d=data();d.rows[3].gust=90;const result=assess(d);assert.equal(result.rows[2].gust,90);assert.equal(result.status,'red');
});
for(const [key,row] of [['temp',0],['humidity',0],['wind',0],['gust',1],['prob',1],['rain',1]])test(`null critical ${key} yields Cannot assess`,()=>{
  const d=data();d.rows[row][key]=null;assert.equal(assess(d).status,'grey');
});
test('incomplete review periods fail closed',()=>{assert.equal(assess(data(3)).status,'grey');});
test('stale and impossible future retrieval times fail closed',()=>{
  const stale=data();stale.fetchedAt=now-3*HOUR-1;assert.equal(assess(stale).status,'grey');
  const future=data();future.fetchedAt=now+60001;assert.equal(assess(future).status,'grey');
});
test('freshness boundary remains valid at exactly 3 hours',()=>{const d=data();d.fetchedAt=now-3*HOUR;assert.equal(assess(d).status,'green');});
test('Sri Lanka timezone preserves UTC half-hour offset across local midnight',()=>{
  const midnight=Date.UTC(2025,11,31,18,30);assert.equal(clock(midnight),'00:00');assert.equal(localDate(midnight),'2026-01-01');assert.equal(localHour(start),6);
});
test('workday end includes complete exposure period, not late starts',()=>{
  const d=data(20),bins=hourlyBins(d,s,now);const windows=rankWindows(bins,s,d,now);
  assert.ok(windows.every(w=>localHour(w.start)>=6&&localHour(w.start)+3<=18));assert.equal(windows.length,10);
});
test('status ranking is lower, review, elevated, unavailable',()=>{
  const d=data(20);d.rows[5].rain=.2;d.rows[8].rain=2;d.rows[10].humidity=null;
  const windows=rankWindows(hourlyBins(d,s,now),s,d,now);const scores={green:0,amber:1,red:2,grey:3};
  assert.deepEqual(windows.map(w=>scores[w.status]),windows.map(w=>scores[w.status]).sort((a,b)=>a-b));
});
test('API adapter validates units, equal arrays, timezone and hourly alignment',()=>{
  assert.equal(parseForecast(api(),now).rows.length,2);
  for(const mutate of [x=>x.hourly_units.wind_speed_10m='mph',x=>x.hourly.precipitation.pop(),x=>x.timezone='UTC',x=>x.hourly.time[1]+=1,x=>x.hourly.time=x.hourly.time.map(t=>t+600)]){
    const value=api();mutate(value);assert.throws(()=>parseForecast(value,now));
  }
});
test('API nulls are retained as missing rather than coerced',()=>{const value=api();value.hourly.relative_humidity_2m[0]=null;assert.equal(parseForecast(value,now).rows[0].humidity,null);});
test('settings reject inverted rain screens and incomplete/invalid workdays',()=>{
  for(const partial of [{duration:0},{duration:7},{startHour:18,endHour:6},{rainLow:60,rainHigh:30},{rainAmount:0},{measured:true,concrete:NaN}])assert.throws(()=>validateSettings({...s,...partial}));
});
test('pilot locations are bounded and malformed coordinate types rejected',()=>{
  assert.equal(validateLocation(6.9271,79.8612),true);for(const [lat,lon] of [[null,80],[6,'80'],[0,0],[11,80]])assert.throws(()=>validateLocation(lat,lon));
});
test('sample data are explicitly tagged and runtime dated',()=>{
  const d=sampleForecast(now);assert.equal(d.mode,'sample');assert.ok(d.rows[0].time>=now);assert.equal(d.rows.length,50);
});
test('CSV export records provenance, assumptions, time offset and quoted values',()=>{
  const d=data();const windows=rankWindows(hourlyBins(d,s,now),s,d,now);const csv=csvText(windows,d,{name:'Test, "site"',lat:6.9,lon:79.8},s);
  assert.ok(csv.includes('Test, ""site""'));assert.ok(csv.includes('+05:30'));assert.ok(csv.includes('Open-Meteo'));assert.ok(csv.includes('0.65×10m'));assert.equal(csv.split('\r\n').length,windows.length+1);
  d.mode='sample';assert.ok(csvText(windows,d,{name:'Test',lat:6.9,lon:79.8},s).includes('Synthetic illustration'));
});
