FROM oven/bun:latest AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Pre-bundle CSS
RUN bun run scripts/build.ts

# Runtime stage — just the binary + sharp native deps
FROM oven/bun:latest AS release
WORKDIR /app

# Copy compiled binary
COPY --from=build /app/clawd-files /app/clawd-files

# Copy sharp native bindings (optional, for thumbnails)
COPY --from=build /app/node_modules/sharp /app/node_modules/sharp
COPY --from=build /app/node_modules/@img /app/node_modules/@img

# Static assets needed at runtime
COPY --from=build /app/src/static /app/src/static

RUN mkdir -p /data

ENV DATA_DIR=/data
ENV PORT=5109
EXPOSE 5109

VOLUME ["/data"]

CMD ["/app/clawd-files"]
