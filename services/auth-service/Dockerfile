FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 3001
CMD ["node", "src/index.js"]
auth-service:
  build: ./services/auth-service
  ports:
    - "3001:3001"
  networks:
    - signvue-net
  labels:
    - traefik.enable=true
    - traefik.http.routers.auth.rule=PathPrefix(`/auth`)
    - traefik.http.middlewares.auth-strip.stripprefix.prefixes=/auth
    - traefik.http.routers.auth.middlewares=auth-strip
    - traefik.http.services.auth.loadbalancer.server.port=3001