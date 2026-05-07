# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22 AS builder
WORKDIR /app

RUN npm install -g pnpm@10.6.4

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/jimmy/package.json ./packages/jimmy/
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Install claude CLI
RUN npm install -g @anthropic-ai/claude-code

# Copy build artifacts and dependencies
COPY --from=builder /app/packages/jimmy/dist ./packages/jimmy/dist
COPY --from=builder /app/packages/jimmy/template ./packages/jimmy/template
COPY --from=builder /app/packages/jimmy/package.json ./packages/jimmy/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/jimmy/node_modules ./packages/jimmy/node_modules
COPY --from=builder /app/package.json ./

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Run as non-root (Docker security best practice; claude requires non-root execution)
RUN groupadd --gid 1001 jinn && useradd --uid 1001 --gid 1001 --create-home jinn
RUN mkdir -p /data && chown jinn:jinn /data
USER jinn

ENV JINN_HOME=/data
ENV HOME=/home/jinn
ENV NODE_ENV=production

VOLUME ["/data"]
EXPOSE 7777

ENTRYPOINT ["/entrypoint.sh"]
