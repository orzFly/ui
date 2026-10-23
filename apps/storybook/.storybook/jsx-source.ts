import { Fragment, isValidElement, type ReactElement } from "react";

// Storybook's dynamic snippet prints a story's element with
// react-element-to-jsx-string, which writes some values as no source could:
// a component type as its object (`{{ $$typeof: … }}`), a ref as
// `{{ current: '[Circular]' }}`, an Error as `{Error: …}`, and a function as
// `function noRefCheck() {}`, whose name a production build minifies. The
// printer has no hook for a prop's value; `displayName` is the one option it
// calls with an element, and it calls it on the root, a copy whose props it
// owns, before it reads any prop. So the first call rewrites the whole tree
// there, and the values it cannot spell become functions that `functionValue`
// prints as the source they stand for: a function is the one value the printer
// hands to an option at any depth, inside an object or an array included.

type AnyElement = ReactElement<Record<string, unknown>>;
type Docgen = { __docgenInfo?: { displayName?: string } };
type ComponentType = Docgen & {
  $$typeof?: symbol;
  displayName?: string;
  name?: string;
  render?: ComponentType;
  type?: ComponentType;
};

/** Stand-ins `functionValue` prints as the source they hold. */
const SOURCE = new WeakMap<object, string>();

function source(text: string): () => void {
  const stand = () => {};
  SOURCE.set(stand, text);
  return stand;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/** A name a snippet can write as an expression: `FileText`, `Tabs.List`. */
const NAME = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

const isPlainObject = (value: object): value is Record<string, unknown> => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** A forwardRef, memo or lazy component: an object, not a function. */
const isComponentObject = (value: object): value is ComponentType =>
  !isValidElement(value) &&
  typeof (value as ComponentType).$$typeof === "symbol";

// The printer cuts every `current` short, since one may hold a DOM node.
const isRef = (value: object): boolean => {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === "current";
};

function componentName(type: ComponentType): string | undefined {
  const name =
    type.displayName ??
    type.__docgenInfo?.displayName ??
    (type.render && componentName(type.render)) ??
    (type.type && componentName(type.type));
  return name !== undefined && NAME.test(name) ? name : undefined;
}

/**
 * A value as the printer should see it. Every element, array and plain object
 * is copied, even with nothing in it to replace, so the printer never reaches
 * a story's own: the copies' props are the only ones a later call may write.
 */
function rewrite(
  value: unknown,
  key: string,
  seen: Map<object, unknown>,
): unknown {
  if (value === null || typeof value !== "object") return value;
  // A snippet passes a ref the component made, named after the prop; so one
  // ref under two props gets two names, and is not memoized.
  if (isRef(value)) return source(IDENTIFIER.test(key) ? key : "ref");
  const memo = seen.get(value);
  if (memo !== undefined) return memo;
  if (isValidElement(value)) {
    const element = value as AnyElement;
    // Registered before its props are walked, so a cycle back to it ends at
    // the copy, where the printer's own cycle check sees it.
    const copy = { ...element };
    seen.set(value, copy);
    return Object.assign(copy, { props: rewriteProps(element.props, seen) });
  }
  if (isComponentObject(value)) {
    const stand = source(componentName(value) ?? "Component");
    seen.set(value, stand);
    return stand;
  }
  if (value instanceof Error) {
    const name = IDENTIFIER.test(value.name) ? value.name : "Error";
    return source(`new ${name}(${JSON.stringify(value.message)})`);
  }
  if (Array.isArray(value)) {
    const items: unknown[] = [];
    seen.set(value, items);
    for (const item of value) items.push(rewrite(item, "ref", seen));
    return items;
  }
  if (!isPlainObject(value)) return value;
  const entries: Record<string, unknown> = {};
  seen.set(value, entries);
  for (const k of Object.keys(value)) entries[k] = rewrite(value[k], k, seen);
  return entries;
}

// The printer keys a child as React.Children.toArray does, ".0", and prints a
// keyed fragment in full: an unkeyed one, a shared `<>…</>` constant, would
// print as `<React.Fragment key=".0">`.
const isFragment = (
  node: unknown,
): node is ReactElement<{ children?: unknown }> =>
  isValidElement(node) && node.type === Fragment && node.key === null;

/** Children with every unkeyed fragment inlined, at any depth of arrays. */
function flatten(children: unknown): unknown {
  if (!Array.isArray(children) && !isFragment(children)) return children;
  const flat: unknown[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (isFragment(node)) visit(node.props.children);
    else flat.push(node);
  };
  visit(children);
  return flat.length === 1 ? flat[0] : flat;
}

/** Props objects already rewritten: the root's and every copy below it. */
const done = new WeakSet<object>();

function rewriteProps(
  props: Record<string, unknown>,
  seen: Map<object, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const item = rewrite(value, key, seen);
    next[key] = key === "children" ? flatten(item) : item;
  }
  done.add(next);
  return next;
}

function prepare(element: AnyElement) {
  const { props } = element;
  if (done.has(props) || Object.isFrozen(props)) return;
  Object.assign(props, rewriteProps(props, new Map()));
  done.add(props);
}

const reactSymbolName = (type: { $$typeof?: symbol } | symbol) =>
  (typeof type === "symbol" ? type : (type.$$typeof as symbol))
    .toString()
    .replace(/^Symbol\((.*)\)$/, "$1")
    .split(".")
    .map((segment) =>
      segment
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(""),
    )
    .join(".");

/**
 * Storybook's own element name, which this option replaces: its fallback
 * to a static of the story's `component` for an anonymous function is left
 * out, since the option never sees that component.
 */
function elementName(element: AnyElement): string {
  const type = element.type as unknown as ComponentType | string | symbol;
  if (typeof type === "string") return type;
  if (typeof type === "symbol") return reactSymbolName(type);
  if (type.displayName) return type.displayName;
  if (type.__docgenInfo?.displayName) return type.__docgenInfo.displayName;
  if (type.render?.displayName) return type.render.displayName;
  if (typeof type.$$typeof === "symbol") return reactSymbolName(type);
  if (type.name && type.name !== "_default") return type.name;
  return "No Display Name";
}

/** `parameters.jsx`: the options Storybook passes to its JSX printer. */
export const jsxSourceOptions = {
  displayName(element: AnyElement): string {
    prepare(element);
    return elementName(element);
  },
  functionValue(fn: (...args: never[]) => unknown): string {
    const text = SOURCE.get(fn);
    if (text !== undefined) return text;
    // A callback's body is the story's wiring, and a production build
    // minifies its name; either would mislead a reader.
    return componentName(fn as unknown as ComponentType) ?? "() => {}";
  },
};
