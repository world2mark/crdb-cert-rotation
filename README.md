
## Cycle certs job

This will automate certificate rotations in a production environment without any downtime.

The MZ_SECRETS environment variable represents the Secret-Name:Mount-location tuples.

The example below (JOB spec) illustrates 2 mounts with distinct secrets that might exist in the CRDB pod.

### Disclamer

**This repo is a prototype and usage is at your own risk. We accept no responsiblity for any adverse effects of using this service. I have a prebuilt docker-image (as shown in the Job spec) but uses my own pull-secret.  Please ask if you wish to use my image, but the recommendation is that you build your own via the example Dockerfile included.**

## Example Role/SA to operate with Secrets and Pods

### Service Account

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: crdb-cert-refresher-sa
  namespace: crdb-cert-refresher
```

### Cluster Role

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: crdb-secret-pod-access
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch", "attach", "exec"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create", "get"]
```

### Cluster Role Binding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: crdb-cert-refresher-binding
subjects:
  - kind: ServiceAccount
    name: crdb-cert-refresher-sa
    namespace: crdb-cert-refresher
roleRef:
  kind: ClusterRole
  name: crdb-secret-pod-access
  apiGroup: rbac.authorization.k8s.io
```

## Example Job

```yaml
kind: Job
apiVersion: batch/v1
metadata:
  name: crdb-cert-rotation
  labels:
    mark-zlamal: crdb-cert-rotation
spec:
  backoffLimit: 1
  template:
    metadata:
      labels:
        job-name: crdb-cert-rotation
    spec:
      restartPolicy: Never
      serviceAccountName: crdb-cert-refresher-sa
      serviceAccount: crdb-cert-refresher-sa
      imagePullSecrets:
        - name: zlamal-acr-secret
      containers:
        - name: run-nodejs
          image: zlamalcrdb.azurecr.io/cert-refresh-action-arm64
          env:
            - name: MZ_CRDB_POD_LABEL_KV
              value: 'zlamal:demo-2025'
            - name: MZ_NAMESPACE
              value: zone-2
            - name: MZ_CONTAINER_NAME
              value: cockroachdb-cockroach
            - name: MZ_SECRETS
              value: demo-2025:/cockroach/cockroach-certs,crdb-users:/cockroach/cockroach-certs
      automountServiceAccountToken: true
```
