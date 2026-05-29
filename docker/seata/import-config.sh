#!/bin/sh
set -eu

NACOS_ADDR="${NACOS_ADDR:-nacos:8848}"
DATA_ID="${SEATA_CONFIG_DATA_ID:-seataServer.properties}"
GROUP="${SEATA_CONFIG_GROUP:-SEATA_GROUP}"
CONFIG_FILE="/seata-config/seataServer.properties"
SEATA_ADVERTISE_HOST="${SEATA_ADVERTISE_HOST:-127.0.0.1}"
SEATA_ADVERTISE_PORT="${SEATA_ADVERTISE_PORT:-8091}"
RENDERED_CONFIG="/tmp/seataServer.properties"

case "${SEATA_ADVERTISE_HOST}" in
  ""|127.*|localhost|0.0.0.0|::1)
    echo "SEATA_ADVERTISE_HOST must be a host-reachable non-loopback IPv4 address, got '${SEATA_ADVERTISE_HOST}'" >&2
    exit 1
    ;;
esac

sed \
  -e "s|\${SEATA_ADVERTISE_HOST}|${SEATA_ADVERTISE_HOST}|g" \
  -e "s|\${SEATA_ADVERTISE_PORT}|${SEATA_ADVERTISE_PORT}|g" \
  "${CONFIG_FILE}" > "${RENDERED_CONFIG}"

until curl -fsS "http://${NACOS_ADDR}/nacos/" >/dev/null; do
  echo "waiting for nacos at ${NACOS_ADDR}"
  sleep 2
done

curl -fsS -X POST "http://${NACOS_ADDR}/nacos/v1/cs/configs" \
  --data-urlencode "dataId=${DATA_ID}" \
  --data-urlencode "group=${GROUP}" \
  --data-urlencode "type=properties" \
  --data-urlencode "content@${RENDERED_CONFIG}"

echo "published ${DATA_ID} to ${GROUP}"
