import type { Route } from "./+types/economy";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Economy - N_library" }];
}

export default function Economy() {
  return (
    <div className="page">
      <h1>Economy</h1>
    </div>
  );
}
