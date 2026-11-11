# Multi-stage Dockerfile for React Vite Frontend
FROM node:20-alpine AS build
WORKDIR /app

# Copy package manifests
COPY package.json ./

# Install npm packages
RUN npm install

# Copy source code
COPY . .

# Build Vite application for production
RUN npm run build

# Nginx runtime stage
FROM nginx:alpine AS final

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

