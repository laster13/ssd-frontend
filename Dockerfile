FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile || pnpm install

COPY . .

RUN pnpm run build


FROM node:20-alpine AS runtime

RUN apk add --no-cache bash jq curl

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/static ./static
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/scripts /opt/ssd-frontend-scripts
COPY --from=build /app/version.json ./version.json

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /app/scripts/*.sh \
    && mkdir -p /app/config \
    && ln -sfn /app /ssd-frontend

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "build"]