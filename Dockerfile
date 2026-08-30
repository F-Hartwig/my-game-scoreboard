FROM node:24.19.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . ./
USER node

EXPOSE 3000
CMD ["node", "server.js"]
