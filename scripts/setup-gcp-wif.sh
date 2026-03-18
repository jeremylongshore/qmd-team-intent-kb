#!/usr/bin/env bash
# setup-gcp-wif.sh — Create GCP project and configure Workload Identity Federation
# for tokenless GitHub Actions authentication (Gemini code review, etc.)
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Billing account linked
#   - GitHub CLI (gh) installed
#
# Usage: ./scripts/setup-gcp-wif.sh [PROJECT_ID]

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
PROJECT_ID="${1:-qmd-team-intent-kb}"
GITHUB_ORG="jeremylongshore"
GITHUB_REPO="qmd-team-intent-kb"
REGION="us-central1"
WIF_POOL="github-actions-pool"
WIF_PROVIDER="github-actions-provider"
SERVICE_ACCOUNT_NAME="github-actions-gemini"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== GCP + WIF Setup for ${GITHUB_ORG}/${GITHUB_REPO} ==="
echo "Project ID: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# ─── Step 1: Create GCP project (or select existing) ─────────────────────────
echo ">>> Step 1: Create/select GCP project"
if gcloud projects describe "${PROJECT_ID}" &>/dev/null; then
  echo "Project ${PROJECT_ID} already exists, selecting it."
else
  echo "Creating project ${PROJECT_ID}..."
  gcloud projects create "${PROJECT_ID}" --name="qmd-team-intent-kb"
fi
gcloud config set project "${PROJECT_ID}"

# ─── Step 2: Enable required APIs ────────────────────────────────────────────
echo ""
echo ">>> Step 2: Enable required APIs"
gcloud services enable \
  aiplatform.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  sts.googleapis.com

echo "APIs enabled."

# ─── Step 3: Create service account ──────────────────────────────────────────
echo ""
echo ">>> Step 3: Create service account"
if gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" &>/dev/null; then
  echo "Service account ${SERVICE_ACCOUNT_EMAIL} already exists."
else
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name="GitHub Actions Gemini Review" \
    --description="Service account for GitHub Actions WIF — Gemini code review"
fi

# ─── Step 4: Grant Vertex AI User role to the service account ─────────────────
echo ""
echo ">>> Step 4: Grant IAM roles"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/aiplatform.user" \
  --condition=None \
  --quiet

echo "Granted roles/aiplatform.user to ${SERVICE_ACCOUNT_EMAIL}"

# ─── Step 5: Create Workload Identity Pool ────────────────────────────────────
echo ""
echo ">>> Step 5: Create Workload Identity Pool"
if gcloud iam workload-identity-pools describe "${WIF_POOL}" \
    --location="global" &>/dev/null; then
  echo "WIF pool ${WIF_POOL} already exists."
else
  gcloud iam workload-identity-pools create "${WIF_POOL}" \
    --location="global" \
    --display-name="GitHub Actions Pool" \
    --description="WIF pool for GitHub Actions OIDC tokens"
fi

# ─── Step 6: Create Workload Identity Provider ───────────────────────────────
echo ""
echo ">>> Step 6: Create Workload Identity Provider"
if gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER}" \
    --location="global" \
    --workload-identity-pool="${WIF_POOL}" &>/dev/null; then
  echo "WIF provider ${WIF_PROVIDER} already exists."
else
  gcloud iam workload-identity-pools providers create-oidc "${WIF_PROVIDER}" \
    --location="global" \
    --workload-identity-pool="${WIF_POOL}" \
    --display-name="GitHub Actions Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository_owner == '${GITHUB_ORG}'"
fi

# ─── Step 7: Allow WIF to impersonate the service account ────────────────────
echo ""
echo ">>> Step 7: Bind WIF to service account"
WIF_POOL_ID=$(gcloud iam workload-identity-pools describe "${WIF_POOL}" \
  --location="global" \
  --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WIF_POOL_ID}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}" \
  --quiet

echo "WIF binding complete."

# ─── Step 8: Get the full provider resource name ─────────────────────────────
echo ""
echo ">>> Step 8: Retrieve WIF provider resource name"
WIF_PROVIDER_FULL=$(gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER}" \
  --location="global" \
  --workload-identity-pool="${WIF_POOL}" \
  --format="value(name)")

echo "WIF Provider: ${WIF_PROVIDER_FULL}"

# ─── Step 9: Set GitHub repository variables ──────────────────────────────────
echo ""
echo ">>> Step 9: Set GitHub repository variables"
gh variable set WIF_PROVIDER --body "${WIF_PROVIDER_FULL}" --repo "${GITHUB_ORG}/${GITHUB_REPO}"
gh variable set WIF_SERVICE_ACCOUNT --body "${SERVICE_ACCOUNT_EMAIL}" --repo "${GITHUB_ORG}/${GITHUB_REPO}"
gh variable set GCP_PROJECT_ID --body "${PROJECT_ID}" --repo "${GITHUB_ORG}/${GITHUB_REPO}"
gh variable set GOOGLE_CLOUD_LOCATION --body "${REGION}" --repo "${GITHUB_ORG}/${GITHUB_REPO}"
gh variable set GOOGLE_GENAI_USE_VERTEXAI --body "true" --repo "${GITHUB_ORG}/${GITHUB_REPO}"

echo "GitHub variables set."

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "=== Setup Complete ==="
echo ""
echo "WIF Provider:      ${WIF_PROVIDER_FULL}"
echo "Service Account:   ${SERVICE_ACCOUNT_EMAIL}"
echo "GCP Project:       ${PROJECT_ID}"
echo "Region:            ${REGION}"
echo ""
echo "GitHub variables configured for ${GITHUB_ORG}/${GITHUB_REPO}:"
echo "  WIF_PROVIDER"
echo "  WIF_SERVICE_ACCOUNT"
echo "  GCP_PROJECT_ID"
echo "  GOOGLE_CLOUD_LOCATION"
echo "  GOOGLE_GENAI_USE_VERTEXAI"
echo ""
echo "Gemini code review will now run automatically on PRs targeting main."
