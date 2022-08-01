FROM node:18-alpine as builder
WORKDIR /build
COPY package.json ./
RUN npm install --only=production --ignore-scripts

FROM node:18-alpine
RUN apk update && apk add --no-cache dumb-init
ENV HOME=/home/app
ENV APP_HOME=$HOME/node/
ENV NODE_ENV=production
WORKDIR $APP_HOME
COPY --chown=node:node . $APP_HOME
COPY --chown=node:node --from=builder /build $APP_HOME

USER node
EXPOSE 3000
ENTRYPOINT ["dumb-init"]
CMD ["npm", "start"]
