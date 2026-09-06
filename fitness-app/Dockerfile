# Imagem sem build e sem dependencias: so o Node e o codigo.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    COOKIE_SECURE=1 \
    FITNESS_DB=/data/fitness.db \
    FITNESS_BACKUP_DIR=/data/backups

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# O disco persistente e montado em /data; o usuario node precisa escrever nele.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 8080
CMD ["node", "src/server.js"]
