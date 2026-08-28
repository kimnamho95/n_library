import type { Route } from "./+types/weather";
import { Forecast } from "./forecast";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Weather - N_library" }];
}

const LOCATIONS = [
  {
    label: "Seoul, South Korea",
    latitude: 37.5665,
    longitude: 126.978,
    nullschoolUrl:
      "https://earth.nullschool.net/#current/wind/surface/level/orthographic=-233.02,37.57,1508",
  },
  {
    label: "Manila, Philippines",
    latitude: 14.5995,
    longitude: 120.9842,
    nullschoolUrl:
      "https://earth.nullschool.net/#current/wind/surface/level/orthographic=-239.02,14.60,1508",
  },
];

export default function Weather() {
  return (
    <div className="page">
      <h1>Weather</h1>

      <section className="data-section">
        <div className="weather-locations-grid">
          {LOCATIONS.map((loc) => (
            <div key={loc.label} className="weather-location">
              <Forecast
                latitude={loc.latitude}
                longitude={loc.longitude}
                locationLabel={loc.label}
              />

              <div className="weather-embed">
                <iframe
                  src={loc.nullschoolUrl}
                  title={`earth.nullschool.net - wind over ${loc.label}`}
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
