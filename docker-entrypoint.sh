#!/bin/sh

# Set a default value if API_BASE_URL is not provided
if [ -z "$API_BASE_URL" ]; then
    DEFAULT_URL="https://api-tracking.hard-softwerk.com"
    echo "window.API_BASE_URL = '${DEFAULT_URL}';" > /usr/share/nginx/html/env.js
else
    # Strip any outer quotes and wrap the value in single quotes
    CLEANED_URL=$(echo "$API_BASE_URL" | sed "s/^['\"]//;s/['\"]$//")
    echo "window.API_BASE_URL = '${CLEANED_URL}';" > /usr/share/nginx/html/env.js
fi

# Verify the file was created correctly
cat /usr/share/nginx/html/env.js

# Start nginx
nginx -g "daemon off;"
