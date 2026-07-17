#!/usr/bin/env bash
set -euo pipefail

# ─── Fill in these 4 values ───────────────────────────────────────────────────
ELASTIC_NODE="https://REPLACE_WITH_YOUR_ES_URL"
KIBANA_NODE="https://REPLACE_WITH_YOUR_KIBANA_URL"
ELASTIC_API_KEY="REPLACE_WITH_YOUR_ES_API_KEY"
KIBANA_API_KEY="REPLACE_WITH_YOUR_KIBANA_API_KEY"
# ──────────────────────────────────────────────────────────────────────────────

IMAGE="kennethfoo24/security-generator:latest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "==> Building Docker image..."
docker build -t "$IMAGE" "$REPO_ROOT"

echo "==> Pushing to Docker Hub..."
docker push "$IMAGE"

echo "==> Applying ConfigMap (with your Elastic URLs)..."
kubectl create configmap sec-gen-config \
  --from-literal=ELASTIC_NODE="$ELASTIC_NODE" \
  --from-literal=KIBANA_NODE="$KIBANA_NODE" \
  --from-literal=SERVERLESS="true" \
  --from-literal=EVENT_INDEX="logs-testlogs-default" \
  --from-literal=EVENT_DATE_OFFSET_HOURS="0" \
  --from-literal=LOG_LEVEL="info" \
  --from-literal=SCENARIO_FILE="/config/scenario.json" \
  --from-file=scenario.json="$SCRIPT_DIR/../../deploy/scenario.example.json" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Creating/updating credentials secret..."
kubectl create secret generic sec-gen-credentials \
  --from-literal=ELASTIC_API_KEY="$ELASTIC_API_KEY" \
  --from-literal=KIBANA_API_KEY="$KIBANA_API_KEY" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Deploying..."
kubectl apply -f "$SCRIPT_DIR/deployment.yaml"

echo "==> Waiting for rollout..."
kubectl rollout status deployment/sec-gen-runner

echo ""
echo "Done! Tail logs with:"
echo "  kubectl logs deploy/sec-gen-runner -f"
