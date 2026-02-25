/**
 * Seed script — creates a test bucket with sample files for every renderer.
 * Usage: bun run scripts/seed.ts
 */

const BASE = process.env.BASE_URL ?? "http://localhost:5109";
const ADMIN_KEY = process.env.ADMIN_KEY ?? "dev-admin-key-change-in-production";

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const body = await res.json();
  if (!res.ok) {
    console.error(`  FAIL ${opts.method ?? "GET"} ${path}:`, body);
    process.exit(1);
  }
  return body;
}

function auth(key: string) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// ---- Create key + bucket ----

console.log("Creating API key...");
const { key } = await api("/api/keys", {
  method: "POST",
  headers: auth(ADMIN_KEY),
  body: JSON.stringify({ name: "seed-key" }),
});
console.log(`  Key: ${key}`);

console.log("Creating bucket...");
const { bucket } = await api("/api/buckets", {
  method: "POST",
  headers: auth(key),
  body: JSON.stringify({
    name: "Kitchen Sink",
    description: "Test bucket with every file type. Used for visual QA.",
    purpose: "testing",
  }),
});
console.log(`  Bucket: ${bucket.id}`);

// ---- Upload files ----

const files: [string, string, string][] = [
  // [filename, mime, content]
  ["README.md", "text/markdown", `# Kitchen Sink

This bucket contains **sample files** for every renderer.

## Links

- [Source code](./app.ts) — TypeScript with Shiki highlighting
- [Data](./data.csv) — CSV table
- [Config](./settings.json) — JSON tree view
- [Icon](./icon.svg) — Inline SVG
- [Styles](./theme.css) — CSS highlighting

## Code Block

\`\`\`python
def fibonacci(n: int) -> list[int]:
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib[:n]

print(fibonacci(10))
\`\`\`

> ClawdFiles v4 — *fast file hosting with built-in rendering*

| Feature | Status |
|---------|--------|
| Code highlighting | ✅ |
| Markdown | ✅ |
| CSV tables | ✅ |
| JSON trees | ✅ |
| SVG preview | ✅ |
| Image preview | ✅ |
| PDF embed | ✅ |
| Video/Audio | ✅ |
`],

  ["app.ts", "text/typescript", `import { serve } from "bun";

interface Config {
  port: number;
  host: string;
  debug: boolean;
}

const config: Config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "localhost",
  debug: process.env.NODE_ENV !== "production",
};

type Handler = (req: Request) => Response | Promise<Response>;

const routes: Map<string, Handler> = new Map([
  ["/", () => new Response("Hello, world!")],
  ["/health", () => Response.json({ status: "ok", uptime: process.uptime() })],
  ["/echo", async (req) => {
    const body = await req.text();
    return new Response(body, {
      headers: { "Content-Type": req.headers.get("content-type") ?? "text/plain" },
    });
  }],
]);

serve({
  port: config.port,
  fetch(req) {
    const url = new URL(req.url);
    const handler = routes.get(url.pathname);
    if (handler) return handler(req);
    return new Response("Not Found", { status: 404 });
  },
});

console.log(\`Server running at http://\${config.host}:\${config.port}\`);
`],

  ["utils.py", "text/x-python", `"""Utility functions for data processing."""

from dataclasses import dataclass
from typing import Optional
import hashlib
import json


@dataclass
class FileInfo:
    name: str
    size: int
    mime_type: str
    sha256: Optional[str] = None

    def human_size(self) -> str:
        units = ["B", "KB", "MB", "GB", "TB"]
        size = float(self.size)
        for unit in units:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"


def hash_file(path: str) -> str:
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_config(path: str) -> dict:
    """Load and validate a JSON config file."""
    with open(path) as f:
        config = json.load(f)

    required_keys = {"name", "version", "port"}
    missing = required_keys - config.keys()
    if missing:
        raise ValueError(f"Missing config keys: {missing}")

    return config


if __name__ == "__main__":
    info = FileInfo("example.txt", 1536, "text/plain")
    print(f"{info.name}: {info.human_size()}")
`],

  ["query.sql", "text/x-sql", `-- Daily active buckets with file counts
SELECT
    b.id AS bucket_id,
    b.name AS bucket_name,
    COUNT(f.id) AS file_count,
    SUM(f.size) AS total_bytes,
    MAX(f.uploaded_at) AS last_upload,
    CASE
        WHEN b.expires_at IS NULL THEN 'permanent'
        WHEN b.expires_at < unixepoch() THEN 'expired'
        ELSE 'active'
    END AS status
FROM buckets b
LEFT JOIN files f ON f.bucket_id = b.id
WHERE b.created_at > unixepoch() - 86400 * 30
GROUP BY b.id
HAVING file_count > 0
ORDER BY last_upload DESC
LIMIT 50;

-- Version history for a specific file
WITH version_chain AS (
    SELECT
        fv.version,
        fv.size,
        fv.sha256,
        fv.created_at,
        LAG(fv.size) OVER (ORDER BY fv.version) AS prev_size
    FROM file_versions fv
    WHERE fv.file_id = ?
)
SELECT
    version,
    size,
    sha256,
    datetime(created_at, 'unixepoch') AS uploaded,
    CASE
        WHEN prev_size IS NULL THEN 'initial'
        WHEN size > prev_size THEN '+' || (size - prev_size) || ' bytes'
        WHEN size < prev_size THEN '-' || (prev_size - size) || ' bytes'
        ELSE 'unchanged'
    END AS delta
FROM version_chain
ORDER BY version DESC;
`],

  ["Dockerfile", "text/plain", `FROM oven/bun:latest AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Build
FROM base AS release
COPY --from=deps /app/node_modules node_modules
COPY . .
RUN mkdir -p /data

ENV DATA_DIR=/data
ENV PORT=5109
EXPOSE 5109

HEALTHCHECK --interval=30s --timeout=3s \\
  CMD curl -f http://localhost:5109/health || exit 1

CMD ["bun", "run", "src/index.ts"]
`],

  ["theme.css", "text/css", `:root {
  --bg-deep: #06090f;
  --bg-card: #0d1117;
  --bg-code: #161b22;
  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --accent: #22d3ee;
  --accent-hover: #06b6d4;
  --border: rgba(148, 163, 184, 0.1);
  --success: #4ade80;
  --error: #f87171;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'JetBrains Mono', monospace;
  background: var(--bg-deep);
  color: var(--text);
  line-height: 1.6;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
  transition: border-color 0.2s;
}

.card:hover {
  border-color: var(--accent);
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-deep);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

@media (max-width: 768px) {
  .container { padding: 0 16px; }
  .stats-grid { grid-template-columns: 1fr; }
}
`],

  ["data.csv", "text/csv", `name,language,stars,license,last_commit
bun,TypeScript/Zig,78500,MIT,2026-02-20
deno,TypeScript/Rust,101200,MIT,2026-02-19
node,C++/JavaScript,112000,MIT,2026-02-21
elysia,TypeScript,8900,MIT,2026-02-18
hono,TypeScript,22300,MIT,2026-02-20
fastify,JavaScript,34100,MIT,2026-02-17
express,JavaScript,66800,MIT,2026-02-15
koa,JavaScript,35700,MIT,2026-01-30
"next.js",TypeScript,131000,MIT,2026-02-21
"svelte kit",TypeScript,19800,MIT,2026-02-20
nuxt,TypeScript,56100,MIT,2026-02-19
remix,TypeScript,31400,MIT,2026-02-18
astro,TypeScript,49700,MIT,2026-02-20
fresh,TypeScript,13200,MIT,2026-02-16
`],

  ["settings.json", "application/json", JSON.stringify({
    app: {
      name: "ClawdFiles",
      version: "4.0.0",
      environment: "development",
    },
    server: {
      port: 5109,
      host: "0.0.0.0",
      cors: { origins: ["*"], methods: ["GET", "POST", "PUT", "DELETE"] },
    },
    database: {
      path: "./data/clawd.db",
      wal: true,
      busyTimeout: 5000,
      pragmas: { foreign_keys: "ON", journal_mode: "WAL" },
    },
    storage: {
      dataDir: "./data/files",
      maxFileSize: "100MB",
      allowedTypes: null,
    },
    auth: {
      keyPrefix: "cf4_",
      keyLength: { prefix: 8, secret: 32 },
      hashAlgorithm: "sha256",
    },
    render: {
      maxSize: "2MB",
      shikiTheme: "github-dark",
      languages: ["typescript", "python", "rust", "go", "sql", "bash", "css", "html", "json", "yaml", "markdown"],
    },
    cleanup: {
      intervalMs: 3600000,
      statsAggregation: "hourly",
    },
  }, null, 2)],

  ["icon.svg", "image/svg+xml", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#06090f"/>
      <stop offset="100%" style="stop-color:#0d1117"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#22d3ee"/>
      <stop offset="100%" style="stop-color:#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="24" fill="url(#bg)" stroke="#22d3ee" stroke-width="1" stroke-opacity="0.3"/>
  <g transform="translate(100,90)">
    <rect x="-40" y="-30" width="80" height="70" rx="6" fill="none" stroke="url(#accent)" stroke-width="2.5"/>
    <line x1="-40" y1="-15" x2="40" y2="-15" stroke="#22d3ee" stroke-width="1.5" stroke-opacity="0.4"/>
    <rect x="-30" y="-8" width="35" height="4" rx="2" fill="#22d3ee" opacity="0.6"/>
    <rect x="-30" y="2" width="50" height="4" rx="2" fill="#22d3ee" opacity="0.4"/>
    <rect x="-30" y="12" width="25" height="4" rx="2" fill="#22d3ee" opacity="0.3"/>
    <rect x="-30" y="22" width="40" height="4" rx="2" fill="#22d3ee" opacity="0.2"/>
  </g>
  <text x="100" y="155" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold" fill="#22d3ee">ClawdFiles</text>
  <text x="100" y="172" text-anchor="middle" font-family="monospace" font-size="10" fill="#94a3b8">v4</text>
</svg>`],

  ["deploy.sh", "text/x-sh", `#!/usr/bin/env bash
set -euo pipefail

# ClawdFiles deployment script
APP_NAME="clawd-files"
IMAGE="ghcr.io/user/clawd-files:latest"
DATA_DIR="/opt/clawd-files/data"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "Pulling latest image..."
docker pull "$IMAGE"

log "Stopping existing container..."
docker stop "$APP_NAME" 2>/dev/null || true
docker rm "$APP_NAME" 2>/dev/null || true

log "Starting new container..."
docker run -d \\
  --name "$APP_NAME" \\
  --restart unless-stopped \\
  -p 5109:5109 \\
  -v "$DATA_DIR:/data" \\
  -e ADMIN_KEY="\${ADMIN_KEY:?ADMIN_KEY is required}" \\
  -e BASE_URL="\${BASE_URL:-https://files.example.com}" \\
  "$IMAGE"

log "Waiting for health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:5109/health > /dev/null 2>&1; then
    log "Server is healthy!"
    exit 0
  fi
  sleep 1
done

log "ERROR: Health check failed after 30s"
docker logs "$APP_NAME"
exit 1
`],

  ["config.yaml", "text/yaml", `# ClawdFiles configuration
app:
  name: ClawdFiles
  version: "4.0.0"

server:
  port: 5109
  host: 0.0.0.0

database:
  path: ./data/clawd.db
  pragmas:
    journal_mode: WAL
    foreign_keys: "ON"
    busy_timeout: 5000

render:
  max_size: 2MB
  shiki:
    theme: github-dark
    languages:
      - typescript
      - python
      - rust
      - go
      - sql

cleanup:
  interval: 1h
  expired_buckets: true
  stale_csv_tables: true
`],

  ["Makefile", "text/plain", `# ClawdFiles Makefile
.PHONY: dev test build docker clean

dev:
\tbun --hot src/index.ts

test:
\tbun test test/

build:
\tdocker build -t clawd-files .

docker: build
\tdocker run -p 5109:5109 -v $$(pwd)/data:/data clawd-files

clean:
\trm -rf data/ node_modules/ .cache/

lint:
\tbunx tsc --noEmit

seed:
\tbun run scripts/seed.ts
`],
];

// Generate sample PNG images using sharp
console.log("Generating sample images...");
const sharp = (await import("sharp")).default;

const colors = [
  { name: "banner.png", bg: "#22d3ee", text: "ClawdFiles" },
  { name: "gradient.png", bg: "#06090f", text: "" },
  { name: "photo-placeholder.jpg", bg: "#1e293b", text: "Photo" },
];

for (const { name, bg, text } of colors) {
  const svg = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bg}"/>
      <stop offset="100%" style="stop-color:#0d1117"/>
    </linearGradient></defs>
    <rect width="800" height="400" fill="url(#g)"/>
    ${text ? `<text x="400" y="210" text-anchor="middle" font-family="monospace" font-size="48" font-weight="bold" fill="#e2e8f0">${text}</text>` : ""}
    <text x="400" y="260" text-anchor="middle" font-family="monospace" font-size="16" fill="#94a3b8">800 × 400 sample image</text>
  </svg>`;
  const buf = name.endsWith(".jpg")
    ? await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer()
    : await sharp(Buffer.from(svg)).png().toBuffer();
  files.push([name, name.endsWith(".jpg") ? "image/jpeg" : "image/png", buf as any]);
}

// Generate large CSV (500 rows)
console.log("Generating large CSV...");
const csvHeader = "id,name,email,department,salary,start_date,status,city,country,performance_score";
const departments = ["Engineering", "Marketing", "Sales", "Finance", "HR", "Design", "Support", "Legal", "Product", "Operations"];
const statuses = ["active", "active", "active", "active", "on_leave", "terminated", "active", "probation"];
const cities = ["San Francisco", "New York", "London", "Berlin", "Tokyo", "Sydney", "Toronto", "Austin", "Seattle", "Dublin", "Singapore", "Paris", "Amsterdam", "Stockholm", "Bangalore"];
const countries: Record<string, string> = { "San Francisco": "US", "New York": "US", "Austin": "US", "Seattle": "US", London: "UK", Berlin: "DE", Tokyo: "JP", Sydney: "AU", Toronto: "CA", Dublin: "IE", Singapore: "SG", Paris: "FR", Amsterdam: "NL", Stockholm: "SE", Bangalore: "IN" };
const firstNames = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank", "Ivy", "Jack", "Kate", "Leo", "Mia", "Noah", "Olivia", "Pete", "Quinn", "Rose", "Sam", "Tina"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Lee", "Harris", "Clark", "Lewis", "Young"];

const csvRows: string[] = [csvHeader];
for (let i = 1; i <= 500; i++) {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  const dept = departments[Math.floor(Math.random() * departments.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const salary = 45000 + Math.floor(Math.random() * 155000);
  const year = 2018 + Math.floor(Math.random() * 8);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const score = (1 + Math.random() * 4).toFixed(1);
  csvRows.push(`${i},${first} ${last},${first.toLowerCase()}.${last.toLowerCase()}@example.com,${dept},${salary},${year}-${month}-${day},${status},${city},${countries[city]},${score}`);
}
files.push(["employees.csv", "text/csv", csvRows.join("\n")]);

console.log(`Uploading ${files.length} files...`);

const fd = new FormData();
for (const [name, _mime, content] of files) {
  fd.append("files", new File([content instanceof Buffer ? content : content], name));
}

const { uploaded } = await api(`/api/buckets/${bucket.id}/upload`, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}` },
  body: fd,
});
console.log(`  Uploaded ${uploaded.length} files`);

// ---- Re-upload README to create a version ----

console.log("Re-uploading README.md (creates version 2)...");
const fd2 = new FormData();
fd2.append("files", new File([files[0][2] + "\n---\n*Updated: version 2*\n"], "README.md"));
await api(`/api/buckets/${bucket.id}/upload`, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}` },
  body: fd2,
});
console.log("  Version 2 created");

// ---- Generate upload link ----

console.log("Generating upload link...");
const { url: uploadUrl } = await api(`/api/buckets/${bucket.id}/upload-link`, {
  method: "POST",
  headers: auth(key),
  body: JSON.stringify({ expiresIn: "24h" }),
});
console.log(`  Upload link: ${uploadUrl}`);

// ---- Print summary ----

const shortCodes = uploaded.map((f: any) => `  /s/${f.shortCode} → ${f.path}`).join("\n");

console.log(`
${"=".repeat(60)}
  Seed complete!
${"=".repeat(60)}

  Bucket page:  ${BASE}/${bucket.id}
  API detail:   ${BASE}/api/buckets/${bucket.id}
  ZIP download: ${BASE}/api/buckets/${bucket.id}/zip
  Summary:      ${BASE}/api/buckets/${bucket.id}/summary
  Upload link:  ${uploadUrl}

  API Key:      ${key}
  Bucket ID:    ${bucket.id}

  Short URLs:
${shortCodes}

  Sample pages:
  ${BASE}/${bucket.id}/README.md     (markdown + code blocks)
  ${BASE}/${bucket.id}/app.ts        (TypeScript highlighting)
  ${BASE}/${bucket.id}/utils.py      (Python highlighting)
  ${BASE}/${bucket.id}/query.sql     (SQL highlighting)
  ${BASE}/${bucket.id}/data.csv      (CSV table)
  ${BASE}/${bucket.id}/settings.json (JSON tree)
  ${BASE}/${bucket.id}/icon.svg      (SVG preview)
  ${BASE}/${bucket.id}/theme.css     (CSS highlighting)
  ${BASE}/${bucket.id}/deploy.sh     (Bash highlighting)
  ${BASE}/${bucket.id}/config.yaml   (YAML highlighting)
`);
