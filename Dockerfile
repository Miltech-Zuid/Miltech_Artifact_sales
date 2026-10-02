# --- 1. Frontend bouwen ---
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
ARG VITE_CONTROL_URL=""
ENV VITE_CONTROL_URL=${VITE_CONTROL_URL}
RUN npm run build

# --- 2. Server bouwen ---
FROM rust:1-bookworm AS server
WORKDIR /server
COPY server/Cargo.toml server/Cargo.lock ./
COPY server/src ./src
RUN cargo build --release --locked

# --- 3. Runtime ---
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 app \
 && mkdir /data && chown app /data
WORKDIR /app
COPY --from=server /server/target/release/miltech-sales /app/miltech-sales
COPY --from=web /web/dist /app/web
ENV HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/data \
    WEB_DIST=/app/web
USER app
VOLUME ["/data"]
EXPOSE 8787
CMD ["/app/miltech-sales"]
