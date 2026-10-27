import { builtinThemes } from "@orz/themes";
import { createThemeStore, ThemeProvider } from "@orz/ui/theme";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./app.tsx";
import { THEME_STORAGE_KEY } from "./head.ts";
import { loadPage } from "./pages.ts";
import { storybookRedirect } from "./redirect.ts";
import { BASE, Router } from "./router.tsx";
import { routeFromPathname } from "./routes.ts";
import "./styles.css";

// The page's inline script has normally left already; this covers a page
// served without it.
const redirect = storybookRedirect(location.search, location.hash, BASE);
if (redirect) {
  location.replace(redirect);
} else {
  const themes = createThemeStore({
    storageKey: THEME_STORAGE_KEY,
    themes: builtinThemes,
    terminalThemes: builtinThemes,
  });
  const route = routeFromPathname(location.pathname, BASE);
  // Hydration has to render what the server rendered, so the page's chunk
  // is in before the first render.
  await loadPage(route);
  const app = (
    <StrictMode>
      <ThemeProvider store={themes}>
        <Router initial={route}>
          <App />
        </Router>
      </ThemeProvider>
    </StrictMode>
  );
  // biome-ignore lint/style/noNonNullAssertion: index.html has it.
  const root = document.getElementById("root")!;
  if (root.hasChildNodes()) hydrateRoot(root, app);
  else createRoot(root).render(app);
}
