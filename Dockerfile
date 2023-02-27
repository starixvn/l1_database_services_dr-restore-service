FROM hub.lumigame.com/docker-hub/library/node:18.14-alpine

USER root
ARG NODE_ENV=production
ENV NODE_ENV ${NODE_ENV}
RUN mkdir /app && chown node:node /app \
 && mkdir /files && chown node:node /files \
 && mkdir /secrets && chown node:node /secrets
RUN apk update \
 && apk add --no-cache git
WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH
COPY package.json yarn.lock .npmrc .yarnrc tsconfig.json ./
RUN --mount=type=cache,target=/root/.yarn YARN_CACHE_FOLDER=/root/.yarn yarn install --production --verbose
COPY src src
RUN ls -AlhF src && mv src/app-config.PRODUCTION.ts src/app-config.ts

USER node
RUN git config --global user.email "dr@luminet.vn" \
 && git config --global user.name "DR" \
 && git config --global init.defaultBranch "main" \
 && git config --global safe.directory "*"
VOLUME [ "/files", "/secrets" ]

CMD [ "yarn", "run", "exec:ts" ]
