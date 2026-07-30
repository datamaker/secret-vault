#!/usr/bin/env bash
# CircleCI에서 vault-secret-fetcher 람다를 invoke해서 시크릿을 env 파일로 저장한다.
#
# 사용법: fetch-secrets.sh <function-name> <env-id> <output-env-file>
#   예:   fetch-secrets.sh vault-secret-fetcher-prod <envId> /tmp/secrets.env
#
# 이후 배포 스텝에서: source /tmp/secrets.env && npx serverless deploy
#
# 주의: 이 스크립트는 시크릿 값을 stdout에 절대 출력하지 않는다.
set -euo pipefail

FUNCTION_NAME="$1"
ENV_ID="$2"
OUTPUT_FILE="$3"

PAYLOAD_FILE="$(mktemp)"
trap 'rm -f "$PAYLOAD_FILE"' EXIT

INVOKE_META=$(aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --cli-binary-format raw-in-base64-out \
  --payload "{\"envId\":\"${ENV_ID}\"}" \
  "$PAYLOAD_FILE")

# 함수 에러 시 payload에는 에러 메시지만 담기므로 출력해도 안전하다.
if echo "$INVOKE_META" | grep -q '"FunctionError"'; then
  echo "ERROR: secret-fetcher lambda returned an error:" >&2
  cat "$PAYLOAD_FILE" >&2
  exit 1
fi

# {"secrets": {KEY: value}} -> export KEY='value' (single-quote escaped)
jq -r '.secrets | to_entries[] | "export \(.key)=\(.value | @sh)"' \
  "$PAYLOAD_FILE" > "$OUTPUT_FILE"

chmod 600 "$OUTPUT_FILE"

COUNT=$(jq -r '.secrets | length' "$PAYLOAD_FILE")
echo "Fetched ${COUNT} secrets from ${FUNCTION_NAME} (envId=${ENV_ID}) -> ${OUTPUT_FILE}"
