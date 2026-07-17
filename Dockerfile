FROM node:24-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json yarn.lock ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy source
COPY src/ ./src/
COPY data/ ./data/
COPY tsconfig.json ./

# Copy any mappings if present at repo root (some code references them)
# They live in src/mappings/ which is already covered by src/ copy above

ENV NODE_ENV=production
# LOG_LEVEL can be overridden at runtime; default info is fine
ENV LOG_LEVEL=info

# Health probe port
EXPOSE 8080

# Config is supplied via env vars at runtime:
#   ELASTIC_NODE, ELASTIC_API_KEY, KIBANA_NODE, KIBANA_API_KEY,
#   SERVERLESS=true, EVENT_INDEX, EVENT_DATE_OFFSET_HOURS=0
# Optional: SCENARIO_FILE=/config/scenario.json (mounted ConfigMap)

ENTRYPOINT ["node", "src/index.ts", "simulate"]
