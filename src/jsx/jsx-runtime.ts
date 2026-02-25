const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

function escapeAttr(val: string): string {
  return val.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderChildren(children: unknown[]): string {
  let out = "";
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) {
      out += renderChildren(child);
    } else {
      out += String(child);
    }
  }
  return out;
}

type Props = Record<string, unknown> & { children?: unknown };
type Component = (props: Props) => string;

export function jsx(tag: string | Component, props: Props | null): string {
  if (!props) props = {};
  const { children, ...rest } = props;

  // Function component
  if (typeof tag === "function") {
    return tag({ ...rest, children });
  }

  // Build attributes
  let attrs = "";
  for (const [key, val] of Object.entries(rest)) {
    if (val === false || val === null || val === undefined) continue;
    if (key === "dangerouslySetInnerHTML") continue;
    if (val === true) {
      attrs += ` ${key}`;
    } else {
      attrs += ` ${key}="${escapeAttr(String(val))}"`;
    }
  }

  const open = `<${tag}${attrs}>`;

  if (VOID_TAGS.has(tag)) return open;

  // dangerouslySetInnerHTML
  const rawHtml = (rest as any).dangerouslySetInnerHTML;
  if (rawHtml && rawHtml.__html) {
    return `${open}${rawHtml.__html}</${tag}>`;
  }

  const inner = children !== undefined ? renderChildren(Array.isArray(children) ? children : [children]) : "";
  return `${open}${inner}</${tag}>`;
}

export { jsx as jsxs, jsx as jsxDEV };

export function Fragment(props: Props): string {
  const { children } = props;
  return children !== undefined ? renderChildren(Array.isArray(children) ? children : [children]) : "";
}

// Helper for injecting pre-rendered HTML without escaping
export function Raw({ html }: { html: string }): string {
  return html;
}

// Namespace for type checking
export namespace JSX {
  export type Element = string;
  export interface IntrinsicElements {
    [tag: string]: any;
  }
  export interface ElementChildrenAttribute {
    children: {};
  }
}
