import type { Route } from "./+types/blog";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Blog - N_library" }];
}

export default function Blog() {
  return (
    <div className="page">
      <h1>Blog</h1>
    </div>
  );
}
