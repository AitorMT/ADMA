FROM node:20-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install -g bun
RUN bun install
COPY . .
RUN bun run build


FROM nginx:stable-alpine as production
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
