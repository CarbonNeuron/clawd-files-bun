FROM oven/bun:latest AS build
WORKDIR /app

ARG COMMIT_HASH=dev

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Compile binary
RUN bun run scripts/build.ts

# Runtime stage — just the binary + sharp native deps
FROM oven/bun:latest AS release
WORKDIR /app

# Copy compiled binary
COPY --from=build /app/clawd-files /app/clawd-files

# Copy sharp and its runtime dependencies (optional, for thumbnails)
COPY --from=build /app/node_modules/sharp /app/node_modules/sharp
COPY --from=build /app/node_modules/@img /app/node_modules/@img
COPY --from=build /app/node_modules/detect-libc /app/node_modules/detect-libc
COPY --from=build /app/node_modules/semver /app/node_modules/semver

# Pre-built client JS bundles (compiled binary can't run Bun.build at runtime)
COPY --from=build /app/src/generated /app/src/generated

# Self-hosted font files
COPY --from=build /app/src/fonts /app/src/fonts

RUN mkdir -p /data

ARG COMMIT_HASH=dev
ENV COMMIT_HASH=${COMMIT_HASH}
ENV NODE_PATH=/app/node_modules
ENV DATA_DIR=/data
ENV PORT=5109
EXPOSE 5109

VOLUME ["/data"]

CMD ["/app/clawd-files"]
