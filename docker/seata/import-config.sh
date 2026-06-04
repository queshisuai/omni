#!/bin/sh
set -eu

NACOS_ADDR="${NACOS_ADDR:-nacos:8848}"
DATA_ID="${SEATA_CONFIG_DATA_ID:-seataServer.properties}"
GROUP="${SEATA_CONFIG_GROUP:-SEATA_GROUP}"
CONFIG_FILE="/seata-config/seataServer.properties"
SEATA_ADVERTISE_HOST="${SEATA_ADVERTISE_HOST:-}"
SEATA_ADVERTISE_PORT="${SEATA_ADVERTISE_PORT:-8091}"
RENDERED_CONFIG="/tmp/seataServer.properties"

case "${SEATA_ADVERTISE_HOST}" in
  ""|127.*|localhost|0.0.0.0|::1)
    echo "SEATA_ADVERTISE_HOST 必须是宿主机可达的非回环 IPv4，当前值为 '${SEATA_ADVERTISE_HOST}'。请运行 scripts/start-seata-docker.ps1 自动注入。" >&2
    exit 1
    ;;
esac

sed \
  -e "s|\${SEATA_ADVERTISE_HOST}|${SEATA_ADVERTISE_HOST}|g" \
  -e "s|\${SEATA_ADVERTISE_PORT}|${SEATA_ADVERTISE_PORT}|g" \
  "${CONFIG_FILE}" > "${RENDERED_CONFIG}"

until curl -fsS "http://${NACOS_ADDR}/nacos/" >/dev/null; do
  echo "等待 Nacos 就绪：${NACOS_ADDR}"
  sleep 2
done

curl -fsS -X POST "http://${NACOS_ADDR}/nacos/v1/cs/configs" \
  --data-urlencode "dataId=${DATA_ID}" \
  --data-urlencode "group=${GROUP}" \
  --data-urlencode "type=properties" \
  --data-urlencode "content@${RENDERED_CONFIG}" >/dev/null

count=0
while IFS= read -r line || [ -n "${line}" ]; do
  trimmed="$(printf '%s' "${line}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  case "${trimmed}" in
    ""|\#*|\!*)
      continue
      ;;
    *=*)
      ;;
    *)
      continue
      ;;
  esac

  key="${trimmed%%=*}"
  value="${trimmed#*=}"
  [ -n "${key}" ] || continue

  curl -fsS -X POST "http://${NACOS_ADDR}/nacos/v1/cs/configs" \
    --data-urlencode "dataId=${key}" \
    --data-urlencode "group=${GROUP}" \
    --data-urlencode "type=properties" \
    --data-urlencode "content=${value}" >/dev/null
  count=$((count + 1))
done < "${RENDERED_CONFIG}"

echo "已发布 ${DATA_ID} 到 ${GROUP}，同步配置项 ${count} 个"
