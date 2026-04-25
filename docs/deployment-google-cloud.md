# Deploying to Google Cloud Run

This guide provides step-by-step instructions for deploying Tududi to Google Cloud using Docker, Artifact Registry, and Cloud Run.

## Prerequisites

- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed and initialized.
- A Google Cloud Project with billing enabled.
- Docker installed locally.

## 1. Enable Required APIs

Run the following command to enable the necessary services in your project:

```bash
gcloud services enable \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com
```

## 2. Build the Docker Image

Build the production image locally from the root of the Tududi repository:

```bash
docker build -t tududi:latest .
```

## 3. Push to Artifact Registry

Google Artifact Registry is the recommended container registry for Google Cloud.

### Create a Repository

Choose a region (e.g., `us-central1`) and create a repository:

```bash
gcloud artifacts repositories create tududi-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for Tududi"
```

### Authenticate Docker

Configure Docker to use `gcloud` as a credential helper:

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Tag and Push the Image

Replace `[PROJECT_ID]` with your actual Google Cloud Project ID:

```bash
# Tag the image
docker tag tududi:latest us-central1-docker.pkg.dev/[PROJECT_ID]/tududi-repo/tududi:latest

# Push the image
docker push us-central1-docker.pkg.dev/[PROJECT_ID]/tududi-repo/tududi:latest
```

## 4. Deploy to Google Cloud Run

### Important: Data Persistence

Tududi uses SQLite as its default database. Cloud Run instances are ephemeral, meaning any data saved to the local container filesystem (like `backend/db/production.sqlite3`) will be lost when the instance scales down or restarts.

To persist your data, you should mount a **Cloud Storage bucket** as a volume (Cloud Run Second Generation execution environment).

### Deployment Command

Replace `[PROJECT_ID]` and set your environment variables:

```bash
gcloud run deploy tududi \
    --image us-central1-docker.pkg.dev/[PROJECT_ID]/tududi-repo/tududi:latest \
    --region us-central1 \
    --allow-unauthenticated \
    --port 3002 \
    --set-env-vars="TUDUDI_USER_EMAIL=admin@example.com,TUDUDI_USER_PASSWORD=your-password,TUDUDI_SESSION_SECRET=$(openssl rand -hex 32),NODE_ENV=production"
```

### Deployment with Persistence (Recommended)

To ensure your tasks and files are not lost:

1. **Create a Cloud Storage bucket:**
   ```bash
   gcloud storage buckets create gs://[PROJECT_ID]-tududi-data --location=us-central1
   ```

2. **Deploy with Volume Mounts:**
   ```bash
   gcloud run deploy tududi \
       --image us-central1-docker.pkg.dev/[PROJECT_ID]/tududi-repo/tududi:latest \
       --region us-central1 \
       --execution-environment=gen2 \
       --add-volume=name=tududi-data,type=cloud-storage,bucket=[PROJECT_ID]-tududi-data \
       --add-volume-mount=volume=tududi-data,mount-path=/data \
       --set-env-vars="DB_FILE=/data/db/production.sqlite3,TUDUDI_UPLOAD_PATH=/data/uploads,TUDUDI_USER_EMAIL=admin@example.com,TUDUDI_USER_PASSWORD=your-password,TUDUDI_SESSION_SECRET=$(openssl rand -hex 32)"
   ```

## Summary of Environment Variables

When deploying, ensure you provide the following critical environment variables:

| Variable | Description |
|----------|-------------|
| `TUDUDI_USER_EMAIL` | The admin email for the initial account. |
| `TUDUDI_USER_PASSWORD` | The admin password for the initial account. |
| `TUDUDI_SESSION_SECRET` | A long, random string for session encryption. |
| `NODE_ENV` | Set to `production`. |
| `DB_FILE` | (Optional) Path to the SQLite database file. |
| `TUDUDI_UPLOAD_PATH` | (Optional) Path where uploaded files are stored. |
