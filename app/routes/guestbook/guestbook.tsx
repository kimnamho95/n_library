import type { Route } from "./+types/guestbook";
import { Guestbook } from "./guestbook-panel";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Guestbook - N_library" }];
}

export default function GuestbookPage() {
  return (
    <div className="page">
      <h1>Guestbook</h1>
      <Guestbook />
    </div>
  );
}
