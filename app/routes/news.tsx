import type { Route } from "./+types/news";

export function meta({}: Route.MetaArgs) {
  return [{ title: "News - N_library" }];
}

export default function News() {
  return (
    <div className="page">
      <h1>News</h1>
    </div>
  );
}
