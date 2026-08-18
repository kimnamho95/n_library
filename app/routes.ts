import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("blog", "routes/blog.tsx"),
  route("economy", "routes/economy.tsx"),
  route("news", "routes/news.tsx"),
  route("technology", "routes/technology.tsx"),
  route("guestbook", "routes/guestbook.tsx"),
] satisfies RouteConfig;
