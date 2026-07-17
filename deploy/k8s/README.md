# Kubernetes Deployment

Run `sec-gen-runner` continuously in Kubernetes, generating security data on a configurable schedule.

## Prerequisites

- Docker (to build and push the image)
- `kubectl` configured against your target cluster
- An Elastic serverless project with:
  - An Elasticsearch API key (`ELASTIC_API_KEY`)
  - A Kibana API key (`KIBANA_API_KEY`)

## Build and push the image

```bash
docker build -t your-registry/sec-gen-runner:latest .
docker push your-registry/sec-gen-runner:latest
```

## Configure

1. Edit `deploy/k8s/configmap.yaml` and replace the placeholder URLs:
   - `ELASTIC_NODE` — your Elasticsearch endpoint
   - `KIBANA_NODE` — your Kibana endpoint
2. Edit `deploy/k8s/deployment.yaml` and replace the `image:` field with your registry path.

## Create credentials

**Option A** — edit `secret.yaml` with base64-encoded values, then apply:

```bash
echo -n 'your-es-key' | base64
# paste the output into secret.yaml under ELASTIC_API_KEY
kubectl apply -f deploy/k8s/secret.yaml
```

**Option B** — use kubectl directly (no file with credentials on disk):

```bash
kubectl create secret generic sec-gen-credentials \
  --from-literal=ELASTIC_API_KEY=<your-es-key> \
  --from-literal=KIBANA_API_KEY=<your-kibana-key>
```

> **Note:** Do not commit `secret.yaml` with real values. It contains placeholder values by design.

## Deploy

```bash
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/deployment.yaml
```

## Watch logs

```bash
kubectl logs deploy/sec-gen-runner -f
```

## Change scenario (which flows run, at what rate)

Edit the `scenario.json` key in `deploy/k8s/configmap.yaml`, then apply and restart:

```bash
kubectl apply -f deploy/k8s/configmap.yaml
kubectl rollout restart deployment/sec-gen-runner
```

You can also copy `deploy/scenario.example.json` as a starting point — it documents every field.

## Scale volume

To generate more data per iteration, increase the flow `args` in the scenario ConfigMap:

- `alertCount`, `hostCount`, `userCount` — controls alert flow output
- `n` — controls event flow output
- `findingsCount` — controls CSP findings output

Apply and restart after editing (see above).

## Pod restart behaviour

The Deployment uses `restartPolicy: Always` (the Kubernetes default). If the pod crashes (e.g., an unhandled error calling `process.exit`), it restarts automatically. All data generation is idempotent, so restarts are safe.

`terminationGracePeriodSeconds: 30` gives the SIGTERM handler enough time to finish any in-flight emit before the pod is forcefully terminated.
