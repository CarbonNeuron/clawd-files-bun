# ClawdFiles v4

File hosting with built-in rendering, versioning, and an API for humans and machines.

## Quick Start

```bash
bun install
cp .env.example .env  # edit ADMIN_KEY
bun run src/index.ts
```

## Development

```bash
bun --hot src/index.ts     # hot reload
bun test test/             # run tests
bun run scripts/seed.ts    # create test bucket with sample files
```

## Build

```bash
bun run scripts/build.ts   # compile to single binary
./clawd-files              # run it
```

## Docker

```bash
docker build -t clawd-files .
docker run -p 5109:5109 -v $(pwd)/data:/data -e ADMIN_KEY=your-secret clawd-files
```

## Docker Compose

```yaml
services:
  clawd-files:
    build: .
    ports:
      - "5109:5109"
    volumes:
      - clawd-data:/data
    environment:
      - ADMIN_KEY=change-me-in-production
      - BASE_URL=https://files.example.com
      - PORT=5109
    restart: unless-stopped

volumes:
  clawd-data:
```

Save as `docker-compose.yml` and run:

```bash
docker compose up -d
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_KEY` | (required) | Admin authentication key |
| `PORT` | `5109` | Server port |
| `DATA_DIR` | `./data` | SQLite database and file storage |
| `BASE_URL` | `http://localhost:5109` | Public URL (for short links) |
| `MAX_RENDER_SIZE` | `2097152` | Max file size for preview rendering (bytes) |
| `LOG_LEVEL` | `info` | Logging verbosity: `debug`, `info`, `warn`, `error` |

## API

See `/docs` for interactive API documentation, or `/llms.txt` for a plain text reference.
