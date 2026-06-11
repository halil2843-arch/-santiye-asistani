# ---- Stage 1: Bağımlılıklar ----
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN npm run build

# ---- Stage 3: Production runner ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Standalone output ile birlikte gelen public ve statik dosyalar
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
