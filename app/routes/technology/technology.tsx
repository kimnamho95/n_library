import type { Route } from "./+types/technology";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Technology - N_library" }];
}

export default function Technology() {
  return (
    <div className="page">
      <h1>Technology</h1>
    </div>
  );
}
