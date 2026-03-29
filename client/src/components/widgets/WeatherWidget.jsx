import { useState, useEffect, useContext } from 'react';
import { Cloud } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';
import { SettingsContext } from '../../App';

export default function WeatherWidget({ config, onRemove, onConfigure }) {
  const { settings } = useContext(SettingsContext);
  const [weather, setWeather] = useState(null);
  const city = settings.weather_city || config?.city || '';

  useEffect(() => {
    if (!city) return;
    fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)
      .then(r => r.json())
      .then(data => {
        const current = data.current_condition?.[0];
        if (current) {
          setWeather({
            temp: current.temp_C,
            feels: current.FeelsLikeC,
            desc: current.weatherDesc?.[0]?.value || '',
            humidity: current.humidity,
            wind: current.windspeedKmph,
          });
        }
      })
      .catch(console.error);
  }, [city]);

  return (
    <WidgetWrapper title={city ? `Weather · ${city}` : 'Weather'} icon={Cloud} onRemove={onRemove} onConfigure={onConfigure}>
      {!city ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Set your city in Settings to see weather.</p>
      ) : weather ? (
        <div>
          <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{weather.temp}°C</div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{weather.desc}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Feels {weather.feels}°C · {weather.humidity}% humidity · {weather.wind} km/h wind
          </p>
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      )}
    </WidgetWrapper>
  );
}
