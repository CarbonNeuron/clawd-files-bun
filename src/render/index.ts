// Import all renderers to register them
import "./code";
import "./markdown";
import "./csv";
import "./json";
import "./svg";
import "./image";
import "./pdf";

export { render, getRenderer, registerRenderer } from "./registry";
export { buildStyles } from "./styles";
export { preloadHighlighter } from "./code";
export type { RenderContext } from "./registry";
