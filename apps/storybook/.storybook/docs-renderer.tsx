import {
  AnchorMdx,
  CodeOrSourceMdx,
  Controls,
  Description,
  Docs,
  HeadersMdx,
  Primary,
  Stories,
  Subtitle,
  Title,
  useOf,
} from "@storybook/addon-docs/blocks";
import { MDXProvider } from "@storybook/addon-docs/mdx-react-shim";
import {
  Component,
  type ComponentProps,
  type ReactNode,
  useLayoutEffect,
} from "react";
import { createRoot, type Root } from "react-dom/client";

type DocsProps = ComponentProps<typeof Docs>;

// addon-docs' defaults, which its renderer does not export.
const defaultComponents = {
  code: CodeOrSourceMdx,
  a: AnchorMdx,
  ...HeadersMdx,
};

/**
 * addon-docs' DocsPage (10.6.2), with a link under the title to the guideline
 * page a story file names in `parameters.guidelines`, a path from the docs
 * site's root. Storybook sits at the site's `storybook/`, so the path is one
 * level up from the preview iframe, and the link leaves the manager's frame.
 */
function DocsPage() {
  const { csfFile, preparedMeta } = useOf("meta", ["meta"]);
  const single = Object.keys(csfFile.stories).length === 1;
  const guidelines: unknown = preparedMeta.parameters.guidelines;
  return (
    <>
      <Title />
      <Subtitle />
      {typeof guidelines === "string" && (
        <p>
          <a href={`..${guidelines}`} target="_top">
            Usage guidelines →
          </a>
        </p>
      )}
      <Description of="meta" />
      {single && <Description of="story" />}
      <Primary />
      <Controls />
      {!single && <Stories />}
    </>
  );
}

class ErrorBoundary extends Component<
  { onError: (err: unknown) => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    this.props.onError(err);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Calls `onCommit` once React has committed the tree around it. */
function Committed({
  onCommit,
  children,
}: {
  onCommit: () => void;
  children: ReactNode;
}) {
  useLayoutEffect(onCommit, [onCommit]);
  return children;
}

/**
 * addon-docs' DocsRenderer (10.6.2), with a key that keeps the page mounted,
 * and the DocsPage above as the default page.
 * Its own keys the page with Math.random(), so the re-render Storybook runs on
 * every globals change remounts it, tearing down each inline story while the
 * same change has that story's re-render pending; StoryRender.teardown then
 * reloads the iframe. The key here moves only after an error, which is what
 * the random one was for: the next render clears the boundary's error.
 * Re-check it against addon-docs' on a Storybook upgrade.
 */
export class DocsRenderer {
  private roots = new WeakMap<HTMLElement, Root>();
  private errors = 0;

  render = (
    context: DocsProps["context"],
    docsParameter: DocsProps["docsParameter"],
    element: HTMLElement,
  ) =>
    new Promise<void>((resolve, reject) => {
      let root = this.roots.get(element);
      if (root === undefined) {
        root = createRoot(element);
        this.roots.set(element, root);
      }
      const components = {
        ...defaultComponents,
        ...(docsParameter?.components as object | undefined),
      };
      root.render(
        <Committed onCommit={resolve}>
          <ErrorBoundary
            key={this.errors}
            onError={(err) => {
              this.errors += 1;
              reject(err);
            }}
          >
            <MDXProvider components={components}>
              <Docs
                context={context}
                docsParameter={{ page: DocsPage, ...docsParameter }}
              />
            </MDXProvider>
          </ErrorBoundary>
        </Committed>,
      );
    });

  unmount = (element: HTMLElement) => {
    this.roots.get(element)?.unmount();
    this.roots.delete(element);
  };
}
