{{/*
Expand the name of the chart.
*/}}
{{- define "tududi.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "tududi.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "tududi.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "tududi.labels" -}}
helm.sh/chart: {{ include "tududi.chart" . }}
{{ include "tududi.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "tududi.selectorLabels" -}}
app.kubernetes.io/name: {{ include "tududi.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "tududi.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "tududi.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the secret name for tududi configuration
*/}}
{{- define "tududi.secretName" -}}
{{- printf "%s-config" (include "tududi.fullname" .) }}
{{- end }}

{{/*
Create the PVC name for tududi data
*/}}
{{- define "tududi.pvcName" -}}
{{- if .Values.persistence.existingClaim }}
{{- .Values.persistence.existingClaim }}
{{- else }}
{{- printf "%s-data" (include "tududi.fullname" .) }}
{{- end }}
{{- end }}
