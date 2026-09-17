FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src ./src
COPY config ./config
COPY datos ./datos
COPY supabase ./supabase

EXPOSE 3000

CMD ["node", "--import", "tsx/esm", "src/servidor/api/servidor.ts"]
