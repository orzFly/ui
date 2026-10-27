import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import type { RenderedPage } from "../scripts/html.ts";
import { App } from "./app.tsx";
import { headOf } from "./head.ts";
import { loadPage, pages } from "./pages.ts";
import { BASE, Router } from "./router.tsx";
import { routeFromPathname } from "./routes.ts";

/** Every route the site prerenders, with its page file as the client manifest keys it. */
export const routes = () =>
  pages.map(({ route, file }) => ({ route, file: `src/${file.slice(2)}` }));

/** One page as HTML, from the pathname it is served at (base included). */
export async function render(pathname: string): Promise<RenderedPage> {
  const route = routeFromPathname(pathname, BASE);
  const page = await loadPage(route);
  const html = renderToString(
    <StrictMode>
      <Router initial={route}>
        <App />
      </Router>
    </StrictMode>,
  );
  return {
    status: page ? 200 : 404,
    head: headOf(page?.meta, BASE),
    html,
  };
}
