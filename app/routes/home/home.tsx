import type { Route } from "./+types/home";
import { Welcome } from "./welcome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "N_library" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  return <Welcome />;
}
