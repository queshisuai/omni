#!/bin/sh
set -eu

NACOS_ADDR="${NACOS_ADDR:-nacos:8848}"
DATA_ID="${SEATA_CONFIG_DATA_ID:-seataServer.properties}"
GROUP="${SEATA_CONFIG_GROUP:-SEATA_GROUP}"
CONFIG_FILE="/seata-config/seataServer.properties"

until curl -fsS "http://${NACOS_ADDR}/nacos/" >/dev/null; do
  echo "waiting for nacos at ${NACOS_ADDR}"
  sleep 2
done

curl -fsS -X POST "http://${NACOS_ADDR}/nacos/v1/cs/configs" \
  --data-urlencode "dataId=${DATA_ID}" \
  --data-urlencode "group=${GROUP}" \
  --data-urlencode "type=properties" \
  --data-urlencode "content@${CONFIG_FILE}"

echo "published ${DATA_ID} to ${GROUP}"
