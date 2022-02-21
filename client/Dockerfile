FROM mcr.microsoft.com/vscode/devcontainers/typescript-node as builder
ENV NODE_ENV=production
WORKDIR /build
COPY . .
RUN npm ci --production
RUN npm run build

FROM docker.io/node:lts
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --from=builder /build ./
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
