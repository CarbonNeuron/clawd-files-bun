FROM oven/bun:latest AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS release
COPY --from=install /app/node_modules node_modules
COPY . .

# Create data directory
RUN mkdir -p /data

ENV DATA_DIR=/data
ENV PORT=5109
EXPOSE 5109

VOLUME ["/data"]

CMD ["bun", "run", "src/index.ts"]
