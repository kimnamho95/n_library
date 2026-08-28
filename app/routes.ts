import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home/home.tsx"),
  route("blog", "routes/blog/blog.tsx"),
  route("economy", "routes/economy/economy.tsx"),
  route("news", "routes/news/news.tsx"),
  route("technology", "routes/technology/technology.tsx"),
  route("weather", "routes/weather/weather.tsx"),
  route("guestbook", "routes/guestbook/guestbook.tsx"),
] satisfies RouteConfig;
