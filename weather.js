import {finite,HOUR} from './core.js';
export const LOCATIONS = [
  {name:'Colombo',region:'Western Province',lat:6.9271,lon:79.8612},
  {name:'Kandy',region:'Central Province',lat:7.2906,lon:80.6337},
  {name:'Galle',region:'Southern Province',lat:6.0535,lon:80.2210},
  {name:'Jaffna',region:'Northern Province',lat:9.6615,lon:80.0255}
];
export const FIELDS={temperature_2m:['temp','°C'],relative_humidity_2m:['humidity','%'],wind_speed_10m:['wind','km/h'],wind_gusts_10m:['gust','km/h'],precipitation_probability:['prob','%'],precipitation:['rain','mm']};
export function validateLocation(lat,lon) {
  if(!finite(lat)||!finite(lon)||lat<5||lat>10||lon<79||lon>82) throw new Error('Enter a Sri Lanka pilot location: latitude 5–10, longitude 79–82.');
  return true;
}
export function parseForecast(json,fetchedAt=Date.now()) {
  const h=json?.hourly, units=json?.hourly_units;
  if(json?.timezone!=='Asia/Colombo'||units?.time!=='unixtime'||!Array.isArray(h?.time)||h.time.length<2)throw new Error('Forecast timezone or hourly timestamps are unavailable.');
  for(const [field,[,unit]] of Object.entries(FIELDS))if(units[field]!==unit||!Array.isArray(h[field])||h[field].length!==h.time.length)throw new Error(`Forecast field or unit unavailable: ${field}.`);
  if(h.time.some((t,i)=>!finite(t)||(t+19800)%3600!==0||(i>0&&t-h.time[i-1]!==3600)))throw new Error('Forecast timestamps are not consecutive local hourly values.');
  const rows=h.time.map((time,i)=>{const row={time:time*1000};for(const [field,[key]] of Object.entries(FIELDS))row[key]=finite(h[field][i])?h[field][i]:null;return row;});
  return {mode:'live',fetchedAt,rows};
}
export async function fetchForecast(location,signal) {
  validateLocation(location.lat,location.lon);
  const params=new URLSearchParams({latitude:String(location.lat),longitude:String(location.lon),hourly:Object.keys(FIELDS).join(','),timezone:'Asia/Colombo',forecast_days:'4',wind_speed_unit:'kmh',timeformat:'unixtime'});
  const response=await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal});
  if(!response.ok)throw new Error(`Weather provider returned HTTP ${response.status}.`);
  return parseForecast(await response.json());
}
export function sampleForecast(now=Date.now()) {
  const first=Math.ceil((now+19800000)/HOUR)*HOUR-19800000;
  return {mode:'sample',fetchedAt:now,rows:Array.from({length:50},(_,i)=>{
    const time=first+i*HOUR, hour=new Date(time+19800000).getUTCHours();
    const warmth=Math.max(0,Math.sin((hour-6)/12*Math.PI));
    const wet=i>23&&hour>=13&&hour<=18;
    return {time,temp:25+warmth*7,humidity:90-warmth*26,wind:2+warmth*8,gust:5+warmth*15,prob:wet?70:hour>13&&hour<18?32:12,rain:wet?.6:0};
  })};
}
