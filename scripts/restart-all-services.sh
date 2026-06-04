#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="${OMNI_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
RUN_USER="${OMNI_RUN_USER:-omni}"
JAVA_BIN="${JAVA_BIN:-/usr/bin/java}"
NODE_BIN="${NODE_BIN:-/opt/node-v24/bin/node}"
LOG_DIR="${OMNI_LOG_DIR:-$REPO_ROOT/runtime/logs}"
PID_DIR="${OMNI_PID_DIR:-$REPO_ROOT/runtime/pids}"
SERVICE_ENV_DIR="${OMNI_SERVICE_ENV_DIR:-$REPO_ROOT/runtime/service-env}"
JAVA_OPTS="${JAVA_OPTS:--Xms64m -Xmx192m -XX:MaxMetaspaceSize=128m}"
WAIT_TIMEOUT_SECONDS="${OMNI_WAIT_TIMEOUT_SECONDS:-240}"

BUILD=0
SKIP_BUILD=0
TMP_ENV_DIR=""

usage() {
  cat <<'EOF'
Usage: scripts/restart-all-services.sh [--build|--skip-build]

Restarts Omni runtime services:
  redis, nacos, rabbitmq, elasticsearch, seata,
  java-user, java-ticket, java-order, java-payment, java-notification,
  java-gateway, grab-service, frontend, tengine.

Environment handling:
  - If a service is already running, its /proc/<pid>/environ is copied to a
    temporary file and reused for the restarted process.
  - If a service is not running, the script tries:
      runtime/service-env/all.env
      runtime/service-env/<service>.env
    and then the current shell environment.

Optional environment:
  OMNI_REPO_ROOT, OMNI_RUN_USER, JAVA_BIN, NODE_BIN, JAVA_OPTS,
  OMNI_LOG_DIR, OMNI_PID_DIR, OMNI_SERVICE_ENV_DIR, OMNI_WAIT_TIMEOUT_SECONDS,
  SEATA_CONFIG_FILE, SEATA_CONFIG_GROUP, SEATA_CONFIG_DATA_ID, SEATA_NACOS_ADDR
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      BUILD=1
      ;;
    --skip-build)
      SKIP_BUILD=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [[ "$SKIP_BUILD" -eq 1 ]]; then
  BUILD=0
fi

SERVICES=(
  java-user
  java-ticket
  java-order
  java-payment
  java-notification
  java-gateway
  grab-service
  frontend
)

STOP_ORDER=(
  frontend
  grab-service
  java-gateway
  java-notification
  java-payment
  java-order
  java-ticket
  java-user
)

INFRA_START_UNITS=(
  redis.service
  omni-nacos.service
  omni-rabbitmq.service
  omni-elasticsearch.service
  omni-seata.service
)

INFRA_STOP_UNITS=(
  omni-seata.service
  omni-elasticsearch.service
  omni-rabbitmq.service
  omni-nacos.service
  redis.service
)

PROXY_UNITS=(
  tengine.service
)

declare -A PORT
declare -A CWD
declare -A CMD
declare -A MATCH
declare -A UNIT
declare -A UNIT_PORT
declare -A UNIT_LABEL
declare -A OLD_PID
declare -A ENV_FILE

PORT[java-user]=8081
UNIT[java-user]=omni-user.service
CWD[java-user]="$REPO_ROOT/java/java-user"
CMD[java-user]="$JAVA_BIN $JAVA_OPTS -jar $REPO_ROOT/java/java-user/target/java-user-1.0.0-SNAPSHOT.jar"
MATCH[java-user]="$REPO_ROOT/java/java-user/target/java-user-1.0.0-SNAPSHOT.jar"

PORT[java-ticket]=8082
UNIT[java-ticket]=omni-ticket.service
CWD[java-ticket]="$REPO_ROOT/java/java-ticket"
CMD[java-ticket]="$JAVA_BIN $JAVA_OPTS -jar $REPO_ROOT/java/java-ticket/target/java-ticket-1.0.0-SNAPSHOT.jar"
MATCH[java-ticket]="$REPO_ROOT/java/java-ticket/target/java-ticket-1.0.0-SNAPSHOT.jar"

PORT[java-order]=8083
UNIT[java-order]=omni-order.service
CWD[java-order]="$REPO_ROOT/java/java-order"
CMD[java-order]="$JAVA_BIN $JAVA_OPTS -jar $REPO_ROOT/java/java-order/target/java-order-1.0.0-SNAPSHOT.jar"
MATCH[java-order]="$REPO_ROOT/java/java-order/target/java-order-1.0.0-SNAPSHOT.jar"

PORT[java-payment]=8084
UNIT[java-payment]=omni-payment.service
CWD[java-payment]="$REPO_ROOT/java/java-payment"
CMD[java-payment]="$JAVA_BIN $JAVA_OPTS -jar $REPO_ROOT/java/java-payment/target/java-payment-1.0.0-SNAPSHOT.jar"
MATCH[java-payment]="$REPO_ROOT/java/java-payment/target/java-payment-1.0.0-SNAPSHOT.jar"

PORT[java-notification]=8085
UNIT[java-notification]=omni-notification.service
CWD[java-notification]="$REPO_ROOT/java/java-notification"
CMD[java-notification]="$JAVA_BIN $JAVA_OPTS -jar $REPO_ROOT/java/java-notification/target/java-notification-1.0.0-SNAPSHOT.jar"
MATCH[java-notification]="$REPO_ROOT/java/java-notification/target/java-notification-1.0.0-SNAPSHOT.jar"

PORT[java-gateway]=8088
UNIT[java-gateway]=omni-gateway.service
CWD[java-gateway]="$REPO_ROOT/java/java-gateway"
CMD[java-gateway]="$JAVA_BIN $JAVA_OPTS -jar $REPO_ROOT/java/java-gateway/target/java-gateway-1.0.0-SNAPSHOT.jar"
MATCH[java-gateway]="$REPO_ROOT/java/java-gateway/target/java-gateway-1.0.0-SNAPSHOT.jar"

PORT[grab-service]=3001
UNIT[grab-service]=omni-grab.service
CWD[grab-service]="$REPO_ROOT/nestjs/grab-service"
CMD[grab-service]="$NODE_BIN $REPO_ROOT/nestjs/grab-service/dist/main.js"
MATCH[grab-service]="$REPO_ROOT/nestjs/grab-service/dist/main.js"

PORT[frontend]=3000
UNIT[frontend]=omni-frontend.service
CWD[frontend]="$REPO_ROOT/frontend/.next/standalone"
CMD[frontend]="$NODE_BIN $REPO_ROOT/frontend/.next/standalone/server.js"
MATCH[frontend]="$REPO_ROOT/frontend/.next/standalone/server.js"

UNIT_LABEL[redis.service]=redis
UNIT_PORT[redis.service]=6379
UNIT_LABEL[omni-nacos.service]=nacos
UNIT_PORT[omni-nacos.service]=8848
UNIT_LABEL[omni-rabbitmq.service]=rabbitmq
UNIT_PORT[omni-rabbitmq.service]=5672
UNIT_LABEL[omni-elasticsearch.service]=elasticsearch
UNIT_PORT[omni-elasticsearch.service]=9200
UNIT_LABEL[omni-seata.service]=seata
UNIT_PORT[omni-seata.service]=8091
UNIT_LABEL[tengine.service]=tengine
UNIT_PORT[tengine.service]=80

log() {
  printf '[%(%F %T)T] %s\n' -1 "$*"
}

have_user() {
  id "$RUN_USER" >/dev/null 2>&1
}

prepare_dirs() {
  mkdir -p "$LOG_DIR" "$PID_DIR"
  if [[ "$(id -u)" -eq 0 ]] && have_user; then
    chown "$RUN_USER:$RUN_USER" "$LOG_DIR" "$PID_DIR"
  fi
}

port_pid() {
  local port="$1"
  ss -ltnp 2>/dev/null \
    | sed -nE "s/.*:${port}[[:space:]].*pid=([0-9]+).*/\1/p" \
    | head -n 1
}

port_pids() {
  local port="$1"
  ss -ltnp 2>/dev/null \
    | sed -nE "s/.*:${port}[[:space:]].*pid=([0-9]+).*/\1/p" \
    | sort -n -u
}

match_pids() {
  local name="$1"
  if [[ -n "${MATCH[$name]:-}" ]]; then
    pgrep -f "${MATCH[$name]}" | sort -n -u || true
  fi
}

service_pids() {
  local name="$1"
  {
    match_pids "$name"
    port_pids "${PORT[$name]}"
  } | awk 'NF && !seen[$1]++ { print $1 }'
}

find_pid() {
  local name="$1"
  local pid=""
  pid="$(service_pids "$name" | head -n 1 || true)"
  printf '%s' "$pid"
}

write_env_from_pid() {
  local pid="$1"
  local file="$2"
  perl - "$pid" "$file" <<'PERL'
use strict;
use warnings;
my ($pid, $file) = @ARGV;
open my $in, '<', "/proc/$pid/environ" or exit 0;
local $/;
my $blob = <$in>;
close $in;
open my $out, '>', $file or die "cannot write $file: $!\n";
chmod 0600, $file;
for my $entry (split /\0/, $blob) {
    next unless length $entry;
    my ($key, $value) = split /=/, $entry, 2;
    next unless defined $key && $key =~ /^[A-Za-z_][A-Za-z0-9_]*$/;
    $value = '' unless defined $value;
    $value =~ s/'/'"'"'/g;
    print $out "export $key='$value'\n";
}
close $out;
PERL
}

capture_envs() {
  TMP_ENV_DIR="$(mktemp -d /tmp/omni-restart-env.XXXXXX)"
  if [[ "$(id -u)" -eq 0 ]] && have_user; then
    chown "$RUN_USER:$RUN_USER" "$TMP_ENV_DIR"
  fi
  trap '[[ -n "${TMP_ENV_DIR:-}" ]] && rm -rf "$TMP_ENV_DIR"' EXIT

  for name in "${SERVICES[@]}"; do
    local pid
    pid="$(find_pid "$name")"
    OLD_PID[$name]="$pid"
    ENV_FILE[$name]=""
    if [[ -n "$pid" && -r "/proc/$pid/environ" ]]; then
      ENV_FILE[$name]="$TMP_ENV_DIR/$name.env"
      write_env_from_pid "$pid" "${ENV_FILE[$name]}"
      if [[ "$(id -u)" -eq 0 ]] && have_user; then
        chown "$RUN_USER:$RUN_USER" "${ENV_FILE[$name]}"
      fi
      log "captured env: $name pid=$pid"
    else
      log "no running env to capture: $name"
    fi
  done
}

build_artifacts() {
  if [[ "$BUILD" -ne 1 ]]; then
    return
  fi
  log "building Java services"
  (cd "$REPO_ROOT/java" && mvn -pl java-user,java-ticket,java-order,java-payment,java-notification,java-gateway -am -DskipTests package)
  log "building grab-service"
  (cd "$REPO_ROOT/nestjs/grab-service" && npm run build)
  log "building frontend"
  (cd "$REPO_ROOT/frontend" && npm run build)
}

systemd_available() {
  command -v systemctl >/dev/null 2>&1 || return 1
  for name in "${SERVICES[@]}"; do
    systemctl cat "${UNIT[$name]}" >/dev/null 2>&1 || return 1
  done
}

unit_exists() {
  systemctl cat "$1" >/dev/null 2>&1
}

unit_active_pid() {
  local unit="$1"
  systemctl show -p MainPID --value "$unit" 2>/dev/null | awk '$1 != "0" { print $1 }'
}

port_listening() {
  local port="$1"
  ss -ltn 2>/dev/null | awk -v port=":$port" '$4 ~ port "$" { found = 1 } END { exit found ? 0 : 1 }'
}

port_has_pid() {
  local port="$1"
  local pid="$2"
  [[ -n "$pid" ]] || return 1
  port_pids "$port" | awk -v want="$pid" '$1 == want { found = 1 } END { exit found ? 0 : 1 }'
}

wait_for_systemd_one() {
  local name="$1"
  local unit="${UNIT[$name]}"
  local port="${PORT[$name]}"
  local waited=0
  while [[ "$waited" -lt "$WAIT_TIMEOUT_SECONDS" ]]; do
    local pid
    pid="$(unit_active_pid "$unit")"
    if systemctl is-active --quiet "$unit" \
      && port_has_pid "$port" "$pid"; then
      log "ready: $name unit=$unit pid=$pid port=$port"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  log "ERROR: $name unit=$unit did not become ready within ${WAIT_TIMEOUT_SECONDS}s"
  systemctl status --no-pager "$unit" || true
  return 1
}

wait_for_unit() {
  local unit="$1"
  local port="${UNIT_PORT[$unit]:-}"
  local label="${UNIT_LABEL[$unit]:-$unit}"
  local waited=0
  while [[ "$waited" -lt "$WAIT_TIMEOUT_SECONDS" ]]; do
    if systemctl is-active --quiet "$unit" \
      && { [[ -z "$port" ]] || port_listening "$port"; }; then
      if [[ -n "$port" ]]; then
        log "ready: $label unit=$unit port=$port"
      else
        log "ready: $label unit=$unit"
      fi
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  log "ERROR: $label unit=$unit did not become ready within ${WAIT_TIMEOUT_SECONDS}s"
  systemctl status --no-pager "$unit" || true
  return 1
}

publish_nacos_config() {
  local nacos_addr="$1"
  local group="$2"
  local data_id="$3"
  local content="$4"
  curl -fsS -m 15 -X POST "http://${nacos_addr}/nacos/v1/cs/configs" \
    --data-urlencode "dataId=${data_id}" \
    --data-urlencode "group=${group}" \
    --data-urlencode "type=properties" \
    --data-urlencode "content=${content}" >/dev/null
}

publish_seata_nacos_config() {
  local config_file="${SEATA_CONFIG_FILE:-/etc/omni/seataServer.properties}"
  local group="${SEATA_CONFIG_GROUP:-SEATA_GROUP}"
  local data_id="${SEATA_CONFIG_DATA_ID:-seataServer.properties}"
  local nacos_addr="${SEATA_NACOS_ADDR:-127.0.0.1:8848}"
  local line key value count=0 waited=0

  if [[ ! -f "$config_file" ]]; then
    log "skip seata config publish; missing $config_file"
    return
  fi

  while [[ "$waited" -lt "$WAIT_TIMEOUT_SECONDS" ]]; do
    if curl -fsS -m 3 "http://${nacos_addr}/nacos/" >/dev/null; then
      break
    fi
    sleep 2
    waited=$((waited + 2))
  done

  if [[ "$waited" -ge "$WAIT_TIMEOUT_SECONDS" ]]; then
    log "ERROR: nacos api did not become ready within ${WAIT_TIMEOUT_SECONDS}s"
    return 1
  fi

  log "publishing seata config to nacos: dataId=$data_id group=$group"
  curl -fsS -m 15 -X POST "http://${nacos_addr}/nacos/v1/cs/configs" \
    --data-urlencode "dataId=${data_id}" \
    --data-urlencode "group=${group}" \
    --data-urlencode "type=properties" \
    --data-urlencode "content@${config_file}" >/dev/null

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* || "$line" == \!* || "$line" != *=* ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ -z "$key" ]] && continue
    publish_nacos_config "$nacos_addr" "$group" "$key" "$value"
    count=$((count + 1))
  done < "$config_file"

  log "published seata config items: $count"
}

stop_systemd_unit() {
  local unit="$1"
  if ! unit_exists "$unit"; then
    log "skip missing unit: $unit"
    return
  fi
  log "systemctl stop $unit"
  systemctl stop "$unit"
}

start_systemd_unit() {
  local unit="$1"
  if ! unit_exists "$unit"; then
    log "skip missing unit: $unit"
    return
  fi
  log "systemctl start $unit"
  systemctl reset-failed "$unit" >/dev/null 2>&1 || true
  systemctl start "$unit"
  wait_for_unit "$unit"
}

restart_systemd_services() {
  log "systemd units detected; using systemctl for restart"
  for unit in "${PROXY_UNITS[@]}"; do
    stop_systemd_unit "$unit"
  done

  for name in "${STOP_ORDER[@]}"; do
    stop_systemd_unit "${UNIT[$name]}"
  done

  for unit in "${INFRA_STOP_UNITS[@]}"; do
    stop_systemd_unit "$unit"
  done

  # Clean up orphaned copies left by interrupted manual restarts.
  for name in "${STOP_ORDER[@]}"; do
    stop_one "$name"
  done

  systemctl daemon-reload
  for unit in "${INFRA_START_UNITS[@]}"; do
    start_systemd_unit "$unit"
    if [[ "$unit" == "omni-nacos.service" ]]; then
      publish_seata_nacos_config
    fi
  done

  for name in "${SERVICES[@]}"; do
    log "systemctl start ${UNIT[$name]}"
    systemctl reset-failed "${UNIT[$name]}" >/dev/null 2>&1 || true
    systemctl start "${UNIT[$name]}"
    wait_for_systemd_one "$name"
  done

  for unit in "${PROXY_UNITS[@]}"; do
    start_systemd_unit "$unit"
  done
}

stop_one() {
  local name="$1"
  local pids
  pids="$(service_pids "$name" || true)"
  if [[ -z "$pids" ]]; then
    log "already stopped: $name"
    return
  fi

  log "stopping $name pids=$(echo "$pids" | paste -sd, -)"
  while read -r pid; do
    [[ -n "$pid" ]] || continue
    kill -TERM "$pid" 2>/dev/null || true
  done <<< "$pids"

  for _ in {1..40}; do
    if [[ -z "$(service_pids "$name" || true)" ]]; then
      return
    fi
    sleep 0.25
  done

  pids="$(service_pids "$name" || true)"
  if [[ -n "$pids" ]]; then
    log "force stopping $name pids=$(echo "$pids" | paste -sd, -)"
    while read -r pid; do
      [[ -n "$pid" ]] || continue
      kill -KILL "$pid" 2>/dev/null || true
    done <<< "$pids"
  fi

  for _ in {1..20}; do
    if [[ -z "$(service_pids "$name" || true)" ]]; then
      return
    fi
    sleep 0.25
  done
}

stop_services() {
  for name in "${STOP_ORDER[@]}"; do
    stop_one "$name"
  done
}

quote_path() {
  printf '%q' "$1"
}

start_one() {
  local name="$1"
  local cwd="${CWD[$name]}"
  local command="${CMD[$name]}"
  local log_file="$LOG_DIR/$name.log"
  local pid_file="$PID_DIR/$name.pid"
  local env_file="${ENV_FILE[$name]:-}"
  local env_script=""
  local cwd_q log_q pid_q env_q all_env_q service_env_q command_q

  touch "$log_file" "$pid_file"
  if [[ "$(id -u)" -eq 0 ]] && have_user; then
    chown "$RUN_USER:$RUN_USER" "$log_file" "$pid_file"
  fi

  cwd_q="$(quote_path "$cwd")"
  log_q="$(quote_path "$log_file")"
  pid_q="$(quote_path "$pid_file")"
  command_q="$command"

  if [[ -n "$env_file" && -s "$env_file" ]]; then
    env_q="$(quote_path "$env_file")"
    env_script=". $env_q;"
  else
    all_env_q="$(quote_path "$SERVICE_ENV_DIR/all.env")"
    service_env_q="$(quote_path "$SERVICE_ENV_DIR/$name.env")"
    env_script="[[ -f $all_env_q ]] && . $all_env_q; [[ -f $service_env_q ]] && . $service_env_q;"
  fi

  local launch
  launch="cd $cwd_q; set -a; $env_script set +a; nohup $command_q >> $log_q 2>&1 < /dev/null & echo \$! > $pid_q; echo \$!"

  log "starting $name"
  if [[ "$(id -u)" -eq 0 && "$RUN_USER" != "root" ]] && have_user; then
    runuser -u "$RUN_USER" -- bash -lc "$launch"
  else
    bash -lc "$launch"
  fi
}

wait_for_one() {
  local name="$1"
  local port="${PORT[$name]}"
  local waited=0
  while [[ "$waited" -lt "$WAIT_TIMEOUT_SECONDS" ]]; do
    local pid
    pid="$(find_pid "$name")"
    if [[ -n "$pid" ]] && ss -ltn 2>/dev/null | rg -q ":$port[[:space:]]"; then
      log "ready: $name pid=$pid port=$port"
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  log "ERROR: $name did not listen on port $port within ${WAIT_TIMEOUT_SECONDS}s"
  return 1
}

start_services() {
  for name in "${SERVICES[@]}"; do
    start_one "$name"
    wait_for_one "$name"
  done
}

smoke_check() {
  log "smoke check: user service"
  curl -fsS -m 8 "http://127.0.0.1:${PORT[java-user]}/api/user/help/faqs" >/dev/null
  log "smoke check: gateway"
  curl -fsS -m 8 "http://127.0.0.1:${PORT[java-gateway]}/api/user/help/faqs" >/dev/null
  log "smoke check: frontend"
  curl -fsS -m 8 "http://127.0.0.1:${PORT[frontend]}/" >/dev/null
}

main() {
  prepare_dirs
  if systemd_available; then
    build_artifacts
    restart_systemd_services
    smoke_check
    log "all services restarted"
    return
  fi
  capture_envs
  build_artifacts
  stop_services
  start_services
  smoke_check
  log "all services restarted"
}

main "$@"
