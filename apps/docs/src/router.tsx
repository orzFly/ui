import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { hasPage, loadPage } from "./pages.ts";
import { hrefOf, routeFromPathname } from "./routes.ts";

export const BASE = import.meta.env.BASE_URL;

interface RouterValue {
  route: string;
  navigate: (route: string, hash?: string) => void;
}

const RouterContext = createContext<RouterValue>({
  route: "/",
  navigate: () => {},
});

export const useRouter = () => useContext(RouterContext);

/**
 * History API routing over the pages content/ holds. A navigation fetches
 * the next page's chunk before it commits, so the old page stays up until
 * the new one can replace it whole.
 */
export function Router({
  initial,
  children,
}: {
  initial: string;
  children: ReactNode;
}) {
  const [route, setRoute] = useState(initial);
  // Where to scroll once the next route has rendered; null after Back and
  // Forward, which the browser restores itself.
  const scrollTo = useRef<string | null>(null);
  const latest = useRef(0);

  const go = useCallback(async (next: string, push?: string) => {
    const ticket = ++latest.current;
    await loadPage(next);
    // A slower chunk must not land over a later click.
    if (ticket !== latest.current) return;
    if (push !== undefined) {
      history.pushState(null, "", hrefOf(next, BASE) + push);
      scrollTo.current = push;
    }
    setRoute(next);
  }, []);

  useEffect(() => {
    const onPop = () => go(routeFromPathname(location.pathname, BASE));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [go]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs per route, after its render.
  useLayoutEffect(() => {
    const hash = scrollTo.current;
    scrollTo.current = null;
    if (hash === null) return;
    const target = hash && document.getElementById(hash.slice(1));
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [route]);

  const value = useMemo(
    () => ({
      route,
      navigate: (next: string, hash = "") => void go(next, hash),
    }),
    [route, go],
  );
  return <RouterContext value={value}>{children}</RouterContext>;
}

/**
 * A link to a route of the site, base added. A route with a page navigates
 * in place; any other (Storybook, a file) loads as a document.
 */
export function Link({
  to,
  hash = "",
  onClick,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { to: string; hash?: string }) {
  const { route, navigate } = useRouter();
  return (
    <a
      {...props}
      href={hrefOf(to, BASE) + hash}
      aria-current={to === route && !hash ? "page" : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target ||
          !hasPage(to)
        ) {
          return;
        }
        event.preventDefault();
        navigate(to, hash);
      }}
    />
  );
}
