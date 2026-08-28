import { useEffect, useState } from "react";

const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear", icon: "☀️" },
  1: { label: "Mainly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Dense drizzle", icon: "🌦️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "🌨️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌦️" },
  82: { label: "Violent showers", icon: "🌦️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm", icon: "⛈️" },
  99: { label: "Thunderstorm", icon: "⛈️" },
};

function describeWeatherCode(code: number) {
  return WEATHER_CODES[code] ?? { label: "—", icon: "🌡️" };
}

type ForecastData = {
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
  };
  daily: {
    date: string;
    weatherCode: number;
    max: number;
    min: number;
  }[];
};

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: ForecastData };

type ForecastProps = {
  latitude: number;
  longitude: number;
  locationLabel: string;
};

export function Forecast({ latitude, longitude, locationLabel }: ForecastProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&timezone=auto`;

    fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setState({
          status: "ok",
          data: {
            current: {
              temperature: json.current.temperature_2m,
              humidity: json.current.relative_humidity_2m,
              windSpeed: json.current.wind_speed_10m,
              weatherCode: json.current.weather_code,
            },
            daily: json.daily.time.map((date: string, i: number) => ({
              date,
              weatherCode: json.daily.weather_code[i],
              max: json.daily.temperature_2m_max[i],
              min: json.daily.temperature_2m_min[i],
            })),
          },
        });
      })
      .catch(() => setState({ status: "error" }));
  }, [latitude, longitude]);

  if (state.status === "loading") {
    return <p className="weather-state-msg">Loading…</p>;
  }

  if (state.status === "error") {
    return <p className="weather-state-msg">Failed to load forecast.</p>;
  }

  const { current, daily } = state.data;
  const currentInfo = describeWeatherCode(current.weatherCode);

  return (
    <div className="weather-forecast">
      <div className="weather-current">
        <div className="weather-current-icon">{currentInfo.icon}</div>
        <div className="weather-current-main">
          <div className="weather-current-location">{locationLabel}</div>
          <div className="weather-current-temp">
            {Math.round(current.temperature)}°C
          </div>
          <div className="weather-current-label">{currentInfo.label}</div>
        </div>
        <div className="weather-current-details">
          <div>Humidity {current.humidity}%</div>
          <div>Wind {Math.round(current.windSpeed)} km/h</div>
        </div>
      </div>

      <div className="weather-daily">
        {daily.map((day, i) => {
          const info = describeWeatherCode(day.weatherCode);
          const dayLabel =
            i === 0
              ? "Today"
              : new Date(day.date).toLocaleDateString(undefined, {
                  weekday: "short",
                });

          return (
            <div key={day.date} className="weather-daily-item">
              <div className="weather-daily-day">{dayLabel}</div>
              <div className="weather-daily-icon">{info.icon}</div>
              <div className="weather-daily-temps">
                <span className="weather-daily-max">
                  {Math.round(day.max)}°
                </span>
                <span className="weather-daily-min">
                  {Math.round(day.min)}°
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
