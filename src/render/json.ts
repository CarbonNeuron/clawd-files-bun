import { registerRenderer } from "./registry";

function jsonToHtml(value: unknown, depth: number = 0): string {
  if (value === null) {
    return `<span class="json-null">null</span>`;
  }

  if (typeof value === "string") {
    return `<span class="json-string">"${Bun.escapeHTML(value)}"</span>`;
  }

  if (typeof value === "number") {
    return `<span class="json-number">${value}</span>`;
  }

  if (typeof value === "boolean") {
    return `<span class="json-boolean">${value}</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `<span class="json-null">[]</span>`;
    const open = depth < 2 ? " open" : "";
    let html = `<details${open}><summary>[${value.length} items]</summary>`;
    for (let i = 0; i < value.length; i++) {
      html += `<div style="margin-left:16px">${jsonToHtml(value[i], depth + 1)}${i < value.length - 1 ? "," : ""}</div>`;
    }
    html += `</details>`;
    return html;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return `<span class="json-null">{}</span>`;
    const open = depth < 2 ? " open" : "";
    let html = `<details${open}><summary>{${keys.length} keys}</summary>`;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = (value as Record<string, unknown>)[k];
      html += `<div style="margin-left:16px"><span class="json-key">"${Bun.escapeHTML(k)}"</span>: ${jsonToHtml(v, depth + 1)}${i < keys.length - 1 ? "," : ""}</div>`;
    }
    html += `</details>`;
    return html;
  }

  return `<span>${Bun.escapeHTML(String(value))}</span>`;
}

async function jsonRenderer(content: Buffer): Promise<string> {
  const text = content.toString("utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return `<div class="lumen-json"><pre style="color:#f87171">Invalid JSON: ${Bun.escapeHTML(String(e))}</pre></div>`;
  }
  return `<div class="lumen-json">${jsonToHtml(parsed)}</div>`;
}

registerRenderer(["application/json"], [".json", ".jsonl"], jsonRenderer);
