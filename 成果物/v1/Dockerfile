FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    OUCHI_DB_PATH=/app/data/ouchi.sqlite

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/demo-dist ./demo-dist
COPY --from=build /app/server-dist ./server-dist
COPY --from=build /app/contract-v1 ./contract-v1
COPY --from=build /app/LICENSE ./LICENSE
COPY --from=build /app/ICON_LICENSES.md ./ICON_LICENSES.md

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server-dist/index.js"]
