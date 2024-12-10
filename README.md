# Run Project Locally

- npm install (needed only first time)
- npm run start

## Notes:
- Inside config.js, for HSW11 dev server, inside docker, if excecuted correctly, API_BASE_URL should be injected from .env.dev file.
- If testing locally but need real backend, API_BASE_URL will fall back to https://api-tracking.hard-softwerk.com

# Run Project in Docker

- Copy all files to a directory except node_modules
- Run deploy.sh

## Notes:

- If you need to test in another server (ex: prod), just make a new .env.prod file with the correct API_BASE_URL and run deploy.sh
