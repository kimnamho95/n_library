import type { Route } from "./+types/weather";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Weather - N_library" }];
}

const EARTH_NULLSCHOOL_URL =
  "https://earth.nullschool.net/#current/wind/surface/level/orthographic=-233.90,12.09,1508";

export default function Weather() {
  return (
    <div className="page">
      <h1>Weather</h1>

      <section className="data-section">
        <div className="weather-embed">
          <iframe
            src={EARTH_NULLSCHOOL_URL}
            title="earth.nullschool.net - global wind and weather visualization"
            loading="lazy"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  );
}
