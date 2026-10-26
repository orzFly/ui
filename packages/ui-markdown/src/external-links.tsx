import type { MarkdownPlugin } from "./plugin.ts";

export type ExternalLinksOptions = {
  /** The origin a link has to leave to count as external. Default `window.location.origin`. */
  origin?: string;
};

/**
 * Whether `href` leaves the app: an http(s) address on another origin. A relative or same-origin
 * URL is still the app's, and `mailto:` and friends hand off to another app rather than a page,
 * so a blank tab left behind would be all the reader got.
 */
export function isExternalHref(
  href: string | undefined,
  origin: string = window.location.origin,
): boolean {
  if (href === undefined) return false;
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return false;
  }
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.origin !== origin
  );
}

/**
 * Opens external links in a new tab, with `rel="noopener noreferrer"`; `styles.css` draws a ↗
 * after each one but image links. Links stay real `<a href>`s, and every other link is untouched.
 * Leave it out of the list to keep every link in this tab, as when the reader has not asked for
 * new tabs.
 *
 * Put it after the plugins that draw links of their own (`attachmentLinks`), so those claim
 * theirs first. Returns a new plugin on every call, so memoise the call along with the rest of
 * the plugin list.
 */
export function externalLinks(
  options: ExternalLinksOptions = {},
): MarkdownPlugin {
  return {
    name: "external-links",
    components: {
      a: function ExternalAnchor({ Next, ...props }) {
        if (!isExternalHref(props.href, options.origin)) {
          return <Next {...props} />;
        }
        return <Next {...props} target="_blank" rel="noopener noreferrer" />;
      },
    },
  };
}
