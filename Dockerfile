FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY datos/dialogos ./datos/dialogos
# Archivos originales de solicitudes: la descarga en Excel los entrega tal cual
COPY datos/R2_MX_ETF_Bank_Causal_Analysis_MBA.xlsx ./datos/
COPY datos/original/*.xlsx ./datos/original/

EXPOSE 3000

CMD ["node", "--max-old-space-size=256", "dist/servidor/servidor.js"]
