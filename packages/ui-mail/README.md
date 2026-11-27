# @orz/ui-mail

Mail messages (`.eml`) drawn in the browser: the subject, sender, date and recipients, the body as
plain text or HTML, and the attachments, each of which opens in the attachment viewer with the
renderers the app registered, so a `.patch` from `git send-email` is drawn as a diff. The package
contributes a renderer to `@orz/ui-content`'s registry, so an `.eml` in a viewer is drawn without
importing this package from the viewer's caller.

## Install

<!-- generated:install by scripts/readme.ts: run `pnpm fmt` after changing a peer -->
```bash
pnpm add @orz/ui-mail @orz/query @orz/themes @orz/ui @orz/ui-content lucide-react radix-ui react \
  react-dom sonner
```
<!-- /generated -->

MIME parsing is [postal-mime](https://github.com/postalsys/postal-mime)'s, the one runtime
dependency, about 30 KB gzipped; it is why this is a package of its own. `@orz/ui-content` is a peer
dependency so that the app and every content package share one registry.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-content/styles.css";
@import "@orz/ui-mail/styles.css";
```

It holds no rules of its own; like `@orz/ui`'s stylesheet it registers `@source "./dist"`, so the
package's classes are generated without an `@source` in the app.

## `emlContent`

```tsx
import { ContentRenderers } from "@orz/ui-content";
import { imageContent } from "@orz/ui-content/attachment";
import { patchContent } from "@orz/ui-code";
import { hexContent } from "@orz/ui-hex/content";
import { emlContent } from "@orz/ui-mail";

<ContentRenderers renderers={[imageContent(), patchContent, emlContent, hexContent]}>
  …
</ContentRenderers>;
```

It takes a file in the viewer that is `message/rfc822`, or a `.eml` under a generic type, and has a
`url` or a `load`. Register it before `hexContent`, which takes every file that is not text. In a
document it takes nothing: an `.eml` there stays a link that opens the viewer.

- **`url`** is fetched as bytes, so each part decodes in its own charset.
- **`load`** is used when there is no `url`. Its text has already been decoded once, so a body sent
  as 8bit in a charset other than UTF-8 may come out garbled; give a `url` where you can.

The plain/HTML switch sits in the viewer's title bar. A message over `MAIL_PREVIEW_MAX_BYTES`
offers its download instead, and a file that is not a message says it could not be read.

## `MailMessage`

```tsx
import { MailMessage } from "@orz/ui-mail";

<MailMessage raw={bytes} />;
```

`raw` is an `ArrayBuffer`, a `Uint8Array` or a string, with the same charset caveat as `load`.
The message lays itself out in its parent's width and grows with its content. When it has both a
plain and an HTML body, a switch above the body picks one; plain text is first. A `format=flowed`
body wraps; any other keeps its lines as sent and scrolls sideways, so a diffstat stays aligned.

Attachments are listed in the message's order, unfolded, images as thumbnails. Each opens in a
viewer of its own over the message, paging through all of them, and drawn by the app's renderers:
render `MailMessage` under `ContentRenderers`.

`parseMail(raw)` is the parser on its own, resolving to a `MailData`, and rejecting input with no
headers or past postal-mime's limits.

## Loading

postal-mime is only reached through `import()`, so a bundler splits it into a chunk of its own,
fetched the first time a message is read: an app that registers `emlContent` at its root carries
none of it until a message opens. `emlContent` fetches it beside the message's bytes. Until it has
arrived the message says it is reading; when it does not arrive, the message says so with the
browser's reason and a Retry that fetches it again, and `parseMail` rejects, fetching it again on
the next call.

## HTML bodies

An HTML body is drawn in an `<iframe sandbox>` without `allow-scripts`, so nothing in it runs, and
its `srcdoc` opens with a content policy that loads only what the message carries: inline images
(`cid:`) and `data:` URLs. Remote images, stylesheets and fonts are never fetched, so a tracking
pixel learns nothing, and the message says that they were not loaded. There is no control to load
them. Links open in a new tab, without a referrer. The frame stays white under a dark theme, as mail
is written for a white page.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-mail` | `MailMessage`, `MailMessageProps`, `emlContent`, `MAIL_PREVIEW_MAX_BYTES`, `parseMail`, `MailData`, `MailPart`, `MailAddress` |
| `@orz/ui-mail/styles.css` | the `@source` for the package's classes |
