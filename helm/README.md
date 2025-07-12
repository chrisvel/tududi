# Tududi Helm Chart

This Helm chart deploys [Tududi](https://github.com/chrisvel/tududi), a self-hosted task management application with hierarchical organization, multi-language support, and Telegram integration.

## Description

Tududi is a comprehensive task management tool that helps you organize your life and projects with:

- **Task Management**: Create, update, and delete tasks with due dates and priority levels
- **Hierarchical Organization**: Organize tasks into projects, and projects into areas
- **Recurring Tasks**: Sophisticated recurring task system with multiple patterns
- **Quick Notes**: Create and assign notes to projects
- **Tags**: Enhance organization with custom tags
- **Telegram Integration**: Create tasks directly from Telegram messages
- **Multi-Language Support**: Available in multiple languages
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PersistentVolume provisioner support in the underlying infrastructure (if persistence is enabled)

## Installing the Chart

To install the chart with the release name `tududi`:

```bash
helm install tududi ./tududi
```

Or from your charts directory:

```bash
helm upgrade --install tududi . --namespace tududi --create-namespace
```

## Uninstalling the Chart

To uninstall/delete the `tududi` deployment:

```bash
helm delete tududi
```

## Configuration

The following table lists the configurable parameters and their default values:

### Image Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `image.repository` | Tududi image repository | `chrisvel/tududi` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `image.tag` | Image tag | `latest` |
| `imagePullSecrets` | Image pull secrets | `[]` |

### Application Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `tududi.user.email` | Initial admin user email | `admin@example.com` |
| `tududi.user.password` | Initial admin user password | `changeme` |
| `tududi.sessionSecret` | Session encryption secret | `changeme-please-use-openssl-rand-hex-64` |
| `tududi.ssl.enabled` | Enable internal SSL | `false` |
| `tududi.allowedOrigins` | CORS allowed origins | `""` |
| `tududi.telegram.enabled` | Enable Telegram integration | `false` |
| `tududi.telegram.botToken` | Telegram bot token | `""` |
| `tududi.scheduler.enabled` | Enable task scheduler | `true` |

### Service Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `service.type` | Kubernetes service type | `ClusterIP` |
| `service.port` | Service port | `3002` |

### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.annotations` | Ingress annotations | `{}` |
| `ingress.hosts` | Ingress hosts configuration | See values.yaml |
| `ingress.tls` | Ingress TLS configuration | `[]` |

### Persistence Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.existingClaim` | Use existing PVC | `""` |
| `persistence.storageClass` | Storage class | `""` |
| `persistence.accessMode` | Access mode | `ReadWriteOnce` |
| `persistence.size` | Storage size | `1Gi` |
| `persistence.dbPath` | Database path in container | `/app/backend/db` |
| `persistence.uploadsPath` | Uploads path in container | `/app/backend/uploads` |

### Resource Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `resources` | CPU/Memory resource requests/limits | `{}` |
| `replicaCount` | Number of replicas | `1` |
| `autoscaling.enabled` | Enable horizontal pod autoscaler | `false` |
| `autoscaling.minReplicas` | Minimum number of replicas | `1` |
| `autoscaling.maxReplicas` | Maximum number of replicas | `100` |
| `autoscaling.targetCPUUtilizationPercentage` | Target CPU utilization | `80` |

### Security Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `podSecurityContext.fsGroup` | Pod security context fsGroup | `1001` |
| `securityContext.runAsUser` | Container security context runAsUser | `1001` |
| `securityContext.runAsGroup` | Container security context runAsGroup | `1001` |
| `securityContext.runAsNonRoot` | Run as non-root user | `true` |
| `securityContext.allowPrivilegeEscalation` | Allow privilege escalation | `false` |

## Usage Examples

### Basic Installation

```bash
# Install with default values
helm install tududi ./tududi

# Install with custom admin credentials
helm install tududi ./tududi \
  --set tududi.user.email=admin@mydomain.com \
  --set tududi.user.password=mysecurepassword \
  --set tududi.sessionSecret=$(openssl rand -hex 64)
```

### Production Installation with Ingress

```bash
helm install tududi ./tududi \
  --set tududi.user.email=admin@company.com \
  --set tududi.user.password=supersecurepassword \
  --set tududi.sessionSecret=$(openssl rand -hex 64) \
  --set tududi.allowedOrigins=https://tududi.company.com \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=tududi.company.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix \
  --set persistence.size=5Gi
```

### Installation with Telegram Integration

```bash
helm install tududi ./tududi \
  --set tududi.telegram.enabled=true \
  --set tududi.telegram.botToken=YOUR_BOT_TOKEN_HERE \
  --set tududi.user.email=admin@example.com \
  --set tududi.user.password=securepassword
```

### Installation with Custom Storage

```bash
helm install tududi ./tududi \
  --set persistence.storageClass=fast-ssd \
  --set persistence.size=10Gi \
  --set persistence.accessMode=ReadWriteOnce
```

## Post-Installation Configuration

### Setting Up Telegram Integration

1. Create a bot with @BotFather on Telegram:
   ```
   /newbot
   ```

2. Get your bot token and either:
   - Set it during installation: `--set tududi.telegram.botToken=YOUR_TOKEN`
   - Configure it later in the Tududi web interface

3. Start chatting with your bot to create tasks directly from Telegram

### Security Best Practices

1. **Change Default Credentials**: Always change the default admin password
2. **Generate Secure Session Secret**: Use `openssl rand -hex 64`
3. **Configure CORS**: Set appropriate `allowedOrigins` for your domain
4. **Use HTTPS**: Enable ingress with TLS certificates
5. **Resource Limits**: Set appropriate CPU/memory limits for your workload

### Monitoring and Health Checks

The chart includes built-in health checks:
- **Liveness Probe**: Checks `/api/health` endpoint
- **Readiness Probe**: Ensures the application is ready to serve traffic
- **Configurable**: Adjust timing and thresholds via `healthCheck` values

### Backup and Recovery

The application data is stored in the persistent volume. To backup:

1. **Database**: Located at `/app/backend/db` in the container
2. **Uploads**: Located at `/app/backend/uploads` in the container

Example backup script:
```bash
kubectl exec -it deployment/tududi -- tar czf - /app/backend/db /app/backend/uploads > tududi-backup-$(date +%Y%m%d).tar.gz
```

## Troubleshooting

### Common Issues

1. **Pod doesn't start**: Check resource limits and node capacity
2. **Database permission issues**: Ensure `fsGroup: 1001` in pod security context
3. **Ingress not working**: Verify ingress controller and DNS configuration
4. **Telegram not working**: Check bot token and network connectivity

### Debugging Commands

```bash
# Check pod status
kubectl get pods -l app.kubernetes.io/name=tududi

# View pod logs
kubectl logs -l app.kubernetes.io/name=tududi

# Check persistent volume
kubectl get pv,pvc

# Test service connectivity
kubectl port-forward svc/tududi 8080:3002
```

## Contributing

To contribute to this Helm chart:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the chart installation
5. Submit a pull request

## License

This Helm chart is distributed under the same license as Tududi. See the [Tududi repository](https://github.com/chrisvel/tududi) for license details.

## Support

- **Tududi Issues**: [GitHub Issues](https://github.com/chrisvel/tududi/issues)
- **Community**: [Discord](https://discord.gg/fkbeJ9CmcH) | [Reddit](https://www.reddit.com/r/tududi/)
- **Documentation**: [Tududi Documentation](https://tududi.com/)
