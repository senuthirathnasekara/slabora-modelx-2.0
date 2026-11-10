"""Capture an actual Open-Meteo response and retrieval metadata. Standard library only."""
import datetime
import json
from pathlib import Path
import urllib.parse
import urllib.request

params = {
    'latitude': '6.9271', 'longitude': '79.8612',
    'hourly': 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability,precipitation',
    'timezone': 'Asia/Colombo', 'forecast_days': '4',
    'wind_speed_unit': 'kmh', 'timeformat': 'unixtime',
}
url = 'https://api.open-meteo.com/v1/forecast?' + urllib.parse.urlencode(params)
with urllib.request.urlopen(url, timeout=18) as response:
    payload = response.read()
    status = response.status
data = json.loads(payload)
captured = datetime.datetime.now(datetime.timezone.utc)
stamp = captured.strftime('%Y%m%dT%H%M%SZ')
out = Path(__file__).resolve().parents[1] / 'evidence' / 'captures'
out.mkdir(parents=True, exist_ok=True)
(out / f'colombo-{stamp}.json').write_bytes(payload)
metadata = {'source':'Open-Meteo Forecast API','request_url':url,
    'retrieved_at_utc':captured.isoformat(),'http_status':status,
    'rows':len(data.get('hourly',{}).get('time',[])),
    'note':'Grid forecast, not measured weather or concrete outcomes.'}
(out / f'colombo-{stamp}-metadata.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf-8')
print(json.dumps(metadata,indent=2))
print(f'Saved under {out}')
