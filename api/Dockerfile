FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json* .npmrc* ./
RUN npm ci || npm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
RUN mkdir -p /app/storage/reports
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
