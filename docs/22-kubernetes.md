# Kubernetes

[← Back to Index](../CLAUDE.md)

---

There's no Helm chart. `docs/examples/kubernetes/` has plain manifests you can copy and adjust: a Deployment, a Service, an Ingress, two volumes and a Secret. It's the same image and the same environment variables as the Docker setup, so everything in `.env.example` works here too.

## Quick start

```bash
cp -r docs/examples/kubernetes tududi-k8s && cd tududi-k8s
cp secret.example.yaml secret.yaml   # fill in the admin user and session secret
# change tududi.example.com in ingress.yaml and deployment.yaml
kubectl apply -k .
```

The first start creates the database and runs the migrations, so give it a minute or two before the pod turns ready.

## Things to know

**Run one replica.** With SQLite the database is a single file, and the schedulers (reminders, recurring tasks, Telegram) run inside the app. Two pods would write to the same file and send everything twice. The Deployment uses `replicas: 1` and the `Recreate` strategy so the old pod stops before the new one starts. If you need more than one web pod, move to PostgreSQL and split web and worker like `docs/examples/docker-compose.hosted.yml` does (`DISABLE_SCHEDULER=true` and `DISABLE_TELEGRAM=true` on the web pods).

**Keep the database on block storage.** local-path, Longhorn or a cloud disk are fine. SQLite on NFS or SMB can corrupt the file. Uploads are plain files, so they can live anywhere. With PostgreSQL (`DATABASE_URL` in the Secret) you don't need the `tududi-db` volume at all.

**Behind an ingress.** Set `TUDUDI_TRUST_PROXY` to the number of proxies in front of the pod (`1` for a plain ingress controller) so rate limiting and logs see real client IPs. Put your public URL in `TUDUDI_ALLOWED_ORIGINS`. ingress-nginx limits request bodies to 1 MB by default, which is why `ingress.yaml` raises it for attachments.

**Volume permissions.** The image starts as root, fixes the ownership of `/app/db` and `/app/uploads`, then drops to uid 1001. On NFS exports with `root_squash` that ownership change fails and the pod crashes on start. In that case run as 1001 from the start with `securityContext.runAsUser: 1001` and skip the entrypoint with `command: ["dumb-init", "--", "/app/backend/cmd/start.sh"]`. The volume has to be writable by uid 1001 for this.

**Upgrades.** Pin an image tag and read the release notes before bumping it. tududi copies the SQLite file next to itself before running migrations (see [backups.md](backups.md)), but that copy lives on the same volume, so it doesn't replace a real backup.

**Backups.** Either snapshot the volume with your storage tooling, or use the export API from a CronJob: `POST /api/v1/backup/export` with an API token, then `GET /api/v1/backup/<uid>/download` and copy the file somewhere off the cluster. Don't copy the SQLite file while the pod is running, the WAL makes that copy unreliable.
