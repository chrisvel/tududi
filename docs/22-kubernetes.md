# Kubernetes

[← Back to Index](../CLAUDE.md)

---

There's no Helm chart. `docs/examples/kubernetes/` has plain manifests you can copy and adjust: a Deployment, a Service, an Ingress, an uploads volume and a Secret. You bring the PostgreSQL database. It's the same image and the same environment variables as the Docker setup, so everything in `.env.example` works here too.

## Quick start

```bash
cp -r docs/examples/kubernetes tududi-k8s && cd tududi-k8s
cp secret.example.yaml secret.yaml   # fill in DATABASE_URL, the admin user and session secret
# change tududi.example.com in ingress.yaml and deployment.yaml
kubectl apply -k .
```

The first start creates the schema in the (empty) database, so give it a minute or two before the pod turns ready.

## Things to know

**Bring a PostgreSQL.** tududi needs `DATABASE_URL` in the Secret and refuses to start without it. A managed database (RDS, Cloud SQL, Azure, DigitalOcean) is the least work. In the cluster, run it as a StatefulSet on block storage (local-path, Longhorn or a cloud disk), for example with the CloudNativePG operator or the Bitnami chart, and point `DATABASE_URL` at its service. Uploads are plain files, so they can live anywhere.

**Run one replica.** The schedulers (reminders, recurring tasks, Telegram) run inside the app. They coordinate through PostgreSQL advisory locks, but one pod is the simple setup. The Deployment uses `replicas: 1` and the `Recreate` strategy so the old pod stops before the new one starts. If you need more than one web pod, split web and worker like `docs/examples/docker-compose.hosted.yml` does (`DISABLE_SCHEDULER=true` and `DISABLE_TELEGRAM=true` on the web pods).

**Coming from 1.x on SQLite.** The manifests no longer mount `/app/db`. Move your data first with [30-moving-to-postgres.md](30-moving-to-postgres.md): export on 1.x, then import into the 2.0 deployment.

**Behind an ingress.** Set `TUDUDI_TRUST_PROXY` to the number of proxies in front of the pod (`1` for a plain ingress controller) so rate limiting and logs see real client IPs. Put your public URL in `TUDUDI_ALLOWED_ORIGINS`. ingress-nginx limits request bodies to 1 MB by default, which is why `ingress.yaml` raises it for attachments.

**Volume permissions.** The image starts as root, fixes the ownership of `/app/uploads`, then drops to uid 1001. On NFS exports with `root_squash` that ownership change fails and the pod crashes on start. In that case run as 1001 from the start with `securityContext.runAsUser: 1001` and skip the entrypoint with `command: ["dumb-init", "--", "/app/backend/cmd/start.sh"]`. The volume has to be writable by uid 1001 for this.

**Upgrades.** Pin an image tag and read the release notes before bumping it. Take a `pg_dump` before you bump it (see [backups.md](backups.md)); pending migrations run on start. Upgrading from 1.x to 2.0 on PostgreSQL: run the final 1.x release once first.

**Backups.** Back up the database with your provider's snapshots or a `pg_dump` CronJob (`scripts/pg-backup.sh` does the dump and pruning), and the uploads volume with your storage tooling. Per-user JSON exports work too: `POST /api/v1/backup/export` with an API token, then `GET /api/v1/backup/<uid>/download` and copy the file somewhere off the cluster.
