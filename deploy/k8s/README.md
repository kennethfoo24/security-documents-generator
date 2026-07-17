# Kubernetes Deployment

## Prerequisites

- Docker (logged in to Docker Hub: `docker login`)
- `kubectl` connected to your cluster (`kubectl get nodes` works)
- An Elastic Serverless project with API keys

## Deploy in one command

**1. Fill in your `.env` file at the repo root** (gitignored — never committed):

```bash
cp .env.example .env
# then open .env and fill in the 4 values
```

Get the URLs from: Elastic Cloud → your project → **Connection details**
Get the API keys from: Kibana → Stack Management → **API Keys** → Create API key

**2. Run the deploy script:**

```bash
bash deploy/k8s/deploy.sh
```

This will:

- Build and push `kennethfoo24/security-generator:latest` to Docker Hub
- Create the ConfigMap and Secret in your cluster
- Deploy the runner as a Deployment (1 replica, always-restart)

**3. Tail the logs:**

```bash
kubectl logs deploy/sec-gen-runner -f
```

You'll see alerts emitting every 60s, events every 30s, CSP findings every 5m.

---

## Update the scenario (change which flows run / how often)

Edit `deploy/scenario.example.json` then re-run `deploy/k8s/deploy.sh`.

Or to update in-place without rebuilding the image:

```bash
kubectl create configmap sec-gen-config \
  --from-file=scenario.json=deploy/scenario.example.json \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart deployment/sec-gen-runner
```

## Scale volume

Increase numbers in `deploy/scenario.example.json`:

- `alertCount`, `hostCount`, `userCount` — controls alert output
- `n` — controls event output
- `findingsCount` — controls CSP findings output

## Tear down

```bash
kubectl delete deployment sec-gen-runner
kubectl delete configmap sec-gen-config
kubectl delete secret sec-gen-credentials
```

## Pod restart behaviour

`restartPolicy: Always` means if the pod crashes it restarts automatically.
`terminationGracePeriodSeconds: 30` gives the SIGTERM handler time to finish in-flight emits.
