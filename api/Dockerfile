FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

FROM base AS deps
# Copy all necessary files for dependency installation
COPY package*.json ./
COPY prisma ./prisma/
# Install dependencies
RUN npm install --production=false

FROM base AS builder  
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build || true

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY . .
RUN mkdir -p /app/prisma /app/storage/reports
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
