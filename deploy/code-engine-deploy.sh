# Sentinel Spec — IBM Code Engine Deployment Spec
# ────────────────────────────────────────────────
# This file documents every IBM CLI command required to build, push, and
# deploy the Sentinel Spec API onto IBM Cloud Code Engine (serverless).
#
# Prerequisites:
#   ibmcloud CLI  ≥ 2.x   (https://cloud.ibm.com/docs/cli)
#   ibmcloud ce plugin    (ibmcloud plugin install code-engine)
#   ibmcloud cr plugin    (ibmcloud plugin install container-registry)
#   Docker / Podman       (for local build validation)
#   jq                    (for CI gate script)
# ────────────────────────────────────────────────

##############################################################################
# 1. ENVIRONMENT VARIABLES (export before running any command)
##############################################################################

export REGION="eu-gb"
export RESOURCE_GROUP="sentinel-rg"
export CE_PROJECT="sentinel-spec-prod"
export CR_NAMESPACE="sentinel-ns"
export IMAGE="icr.io/${CR_NAMESPACE}/sentinel-spec:latest"

# IBM Watsonx AI
export WATSONX_APIKEY="<your-ibm-cloud-api-key>"
export WATSONX_URL="https://${REGION}.ml.cloud.ibm.com"
export PROJECT_ID="<your-watsonx-project-id>"
export WATSONX_MODEL_ID="ibm/granite-20b-code-instruct"

# IBM Cloud Object Storage
export COS_API_KEY="<your-cos-api-key>"
export COS_INSTANCE_ID="<your-cos-crn-instance-id>"
export COS_ENDPOINT="https://s3.${REGION}.cloud-object-storage.appdomain.cloud"
export COS_BUCKET="sentinel-spec-records"


##############################################################################
# 2. AUTHENTICATION & SETUP
##############################################################################

ibmcloud login --apikey "${WATSONX_APIKEY}" -r "${REGION}" -g "${RESOURCE_GROUP}"

# Configure IBM Container Registry namespace
ibmcloud cr login
ibmcloud cr namespace-add "${CR_NAMESPACE}" --resource-group "${RESOURCE_GROUP}"


##############################################################################
# 3. LOCAL BUILD & VALIDATION
##############################################################################

# Build with multi-stage Dockerfile
docker build -t "${IMAGE}" .

# Validate health endpoint locally before pushing
docker run --rm -p 8080:8080 \
  -e MOCK_MODE=true \
  -e WATSONX_APIKEY="${WATSONX_APIKEY}" \
  "${IMAGE}" &

sleep 3
curl -sf http://localhost:8080/health | jq .
curl -sf -X POST http://localhost:8080/evaluate \
  -H "Content-Type: application/json" \
  -d '{"content":"ibm_secret_access_key = \"AKIAIOSFODNN7EXAMPLE\"","file_path":"test.py","language":"python"}' \
  | jq .is_compliant

docker stop $(docker ps -q --filter ancestor="${IMAGE}")


##############################################################################
# 4. PUSH TO IBM CONTAINER REGISTRY
##############################################################################

docker push "${IMAGE}"


##############################################################################
# 5. CODE ENGINE — SELECT / CREATE PROJECT
##############################################################################

ibmcloud ce project select --name "${CE_PROJECT}" 2>/dev/null \
  || ibmcloud ce project create --name "${CE_PROJECT}"


##############################################################################
# 6. CODE ENGINE — CONFIGURE REGISTRY ACCESS (one-time)
##############################################################################

ibmcloud ce registry create \
  --name icr-access \
  --server icr.io \
  --username iamapikey \
  --password "${WATSONX_APIKEY}"


##############################################################################
# 7. CODE ENGINE — CREATE OR UPDATE APPLICATION
##############################################################################

# First deploy: use 'application create'
ibmcloud ce application create \
  --name sentinel-spec-api \
  --image "${IMAGE}" \
  --registry-secret icr-access \
  --port 8080 \
  --cpu 1 \
  --memory 4G \
  --min-scale 1 \
  --max-scale 10 \
  --concurrency 100 \
  --env WATSONX_APIKEY="${WATSONX_APIKEY}" \
  --env WATSONX_URL="${WATSONX_URL}" \
  --env PROJECT_ID="${PROJECT_ID}" \
  --env WATSONX_MODEL_ID="${WATSONX_MODEL_ID}" \
  --env COS_API_KEY="${COS_API_KEY}" \
  --env COS_INSTANCE_ID="${COS_INSTANCE_ID}" \
  --env COS_ENDPOINT="${COS_ENDPOINT}" \
  --env COS_BUCKET="${COS_BUCKET}" \
  --env MOCK_MODE="false"

# Subsequent deploys: use 'application update' to roll out new image
# ibmcloud ce application update \
#   --name sentinel-spec-api \
#   --image "${IMAGE}"


##############################################################################
# 8. RETRIEVE SERVICE URL
##############################################################################

export SENTINEL_API_URL=$(ibmcloud ce application get \
  --name sentinel-spec-api \
  --output json | jq -r '.status.url')

echo "Sentinel Spec API deployed at: ${SENTINEL_API_URL}"
curl -sf "${SENTINEL_API_URL}/health" | jq .


##############################################################################
# 9. COS BUCKET PROVISIONING (one-time)
##############################################################################

# Install COS plugin if not present
ibmcloud plugin install cloud-object-storage

ibmcloud cos config crn --crn "${COS_INSTANCE_ID}"
ibmcloud cos bucket-create \
  --bucket "${COS_BUCKET}" \
  --ibm-service-instance-id "${COS_INSTANCE_ID}" \
  --region "${REGION}" \
  --class Smart


##############################################################################
# 10. SMOKE TEST AFTER DEPLOY
##############################################################################

curl -s -X POST "${SENTINEL_API_URL}/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "def configure():\n    ibm_secret_access_key = \"AKIAIOSFODNN7EXAMPLE\"\n    return ibm_secret_access_key",
    "file_path": "smoke_test.py",
    "language": "python"
  }' | jq '{is_compliant, violations_count: (.violations | length)}'
