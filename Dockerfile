FROM nginx:alpine

# Add build argument
ARG API_BASE_URL
ENV API_BASE_URL=${API_BASE_URL}

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Set working directory
WORKDIR /usr/share/nginx/html

# Copy project files
COPY . .

# Move and make entrypoint script executable
RUN mv docker-entrypoint.sh /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Nginx config
RUN echo 'server { \
    listen 3000; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location ~* \.svg$ { \
        add_header Content-Type "image/svg+xml"; \
        add_header Access-Control-Allow-Origin "*"; \
    } \
    location /Icons/ { \
        alias /usr/share/nginx/html/Icons/; \
        autoindex off; \
    } \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
