const SHORT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const BUCKET_ID_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateShortCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => SHORT_CODE_CHARS[b % SHORT_CODE_CHARS.length]).join("");
}

export function generateBucketId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => BUCKET_ID_CHARS[b % BUCKET_ID_CHARS.length]).join("");
}

const MIME_MAP: Record<string, string> = {
  // Text/Code
  ".txt": "text/plain",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".jsx": "text/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".toml": "text/toml",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".sql": "text/x-sql",
  ".sh": "text/x-sh",
  ".bash": "text/x-sh",
  ".py": "text/x-python",
  ".rb": "text/x-ruby",
  ".rs": "text/x-rust",
  ".go": "text/x-go",
  ".java": "text/x-java",
  ".c": "text/x-c",
  ".cpp": "text/x-c++",
  ".h": "text/x-c",
  ".hpp": "text/x-c++",
  ".php": "text/x-php",
  ".swift": "text/x-swift",
  ".kt": "text/x-kotlin",
  ".r": "text/x-r",
  ".lua": "text/x-lua",
  ".zig": "text/x-zig",
  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  // Video
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  // Documents
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
  ".wasm": "application/wasm",
};

export function getMimeType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}

export function wantsJson(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  // Explicit Accept header takes priority
  if (accept.includes("text/html")) return false;
  if (accept.includes("application/json")) return true;
  // CLI tools default to JSON when no explicit Accept
  const ua = req.headers.get("user-agent") ?? "";
  if (ua.startsWith("curl/") || ua.startsWith("httpie/")) return true;
  return false;
}

export function wantsHtml(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

export function escapeHtml(str: string): string {
  return Bun.escapeHTML(str);
}

export function formatBytes(n: number): string {
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  const value = n / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export function formatRelativeDate(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

export function parseExpiresIn(str: string): number | null {
  if (!str || str === "never") return null;
  const match = str.match(/^(\d+)([hdwm])$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const now = Math.floor(Date.now() / 1000);
  const multipliers: Record<string, number> = { h: 3600, d: 86400, w: 604800, m: 2592000 };
  return now + value * multipliers[unit];
}
