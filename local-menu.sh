#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT="${FRONTEND_PORT:-5500}"
GATEWAY_URL="http://localhost:8000"
PID_FILE="${ROOT_DIR}/.local-frontend.pid"
LOG_FILE="${ROOT_DIR}/.local-frontend.log"

cd "$ROOT_DIR" || exit 1

dc() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

open_url() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1
  elif command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "" "$url" >/dev/null 2>&1
  else
    printf 'Mo tren trinh duyet: %s\n' "$url"
  fi
}

port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  else
    curl -fsS "http://localhost:$1" >/dev/null 2>&1
  fi
}

frontend_url() {
  printf 'http://localhost:%s/client/index.html' "$FRONTEND_PORT"
}

admin_url() {
  printf 'http://localhost:%s/admin/login.html' "$FRONTEND_PORT"
}

pos_url() {
  printf 'http://localhost:%s/pos/login.html' "$FRONTEND_PORT"
}

frontend_ok() {
  curl -fsS "http://localhost:$1/client/index.html" >/dev/null 2>&1
}

pick_frontend_port() {
  local port="$FRONTEND_PORT"
  local max_port=$((FRONTEND_PORT + 20))

  while [ "$port" -le "$max_port" ]; do
    if ! port_in_use "$port"; then
      FRONTEND_PORT="$port"
      return 0
    fi

    if frontend_ok "$port"; then
      FRONTEND_PORT="$port"
      return 0
    fi

    printf 'Port %s dang ban nhung khong tra frontend hop le, thu port tiep theo...\n' "$port"
    port=$((port + 1))
  done

  printf 'Khong tim duoc port frontend trong khoang %s-%s.\n' "$FRONTEND_PORT" "$max_port"
  return 1
}

start_frontend() {
  pick_frontend_port || return 1

  if frontend_ok "$FRONTEND_PORT"; then
    printf 'Frontend: http://localhost:%s (dang chay san)\n' "$FRONTEND_PORT"
    return 0
  fi

  local python_bin=""
  if command -v python3 >/dev/null 2>&1; then
    python_bin="python3"
  elif command -v python >/dev/null 2>&1; then
    python_bin="python"
  else
    printf 'Khong tim thay python/python3 de serve frontend tinh.\n'
    printf 'Ban co the mo truc tiep: frontend/client/index.html\n'
    return 1
  fi

  nohup "$python_bin" -m http.server "$FRONTEND_PORT" --directory "$ROOT_DIR/frontend" >"$LOG_FILE" 2>&1 &
  echo "$!" > "$PID_FILE"
  sleep 1

  if port_in_use "$FRONTEND_PORT"; then
    printf 'Frontend: http://localhost:%s\n' "$FRONTEND_PORT"
  else
    printf 'Khong start duoc frontend. Xem log: %s\n' "$LOG_FILE"
  fi
}

stop_frontend() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1
    fi
    rm -f "$PID_FILE"
  fi
}

health_one() {
  local name="$1"
  local url="$2"

  if curl -fsS "$url" >/dev/null 2>&1; then
    printf '[OK]   %-22s %s\n' "$name" "$url"
  else
    printf '[FAIL] %-22s %s\n' "$name" "$url"
  fi
}

health_all() {
  printf '\nHealth tong:\n'
  health_one "api-gateway" "${GATEWAY_URL}/health"
  health_one "identity-service" "http://localhost:8001/health"
  health_one "catalog-service" "http://localhost:8002/health"
  health_one "order-service" "http://localhost:8003/health"
  health_one "cms-service" "http://localhost:8004/health"
  health_one "notification-service" "http://localhost:8005/health"
  printf '\n'
}

health_menu() {
  printf '\nHealth tung service:\n'
  printf '1. api-gateway\n'
  printf '2. identity-service\n'
  printf '3. catalog-service\n'
  printf '4. order-service\n'
  printf '5. cms-service\n'
  printf '6. notification-service\n'
  printf '0. Quay lai\n'
  printf 'Chon: '
  read -r choice

  case "$choice" in
    1) curl -sS "${GATEWAY_URL}/health"; printf '\n' ;;
    2) curl -sS "http://localhost:8001/health"; printf '\n' ;;
    3) curl -sS "http://localhost:8002/health"; printf '\n' ;;
    4) curl -sS "http://localhost:8003/health"; printf '\n' ;;
    5) curl -sS "http://localhost:8004/health"; printf '\n' ;;
    6) curl -sS "http://localhost:8005/health"; printf '\n' ;;
    0) return 0 ;;
    *) printf 'Lua chon khong hop le.\n' ;;
  esac
}

print_links() {
  printf '\nDuong dan web:\n'
  printf -- '- Khach hang: %s\n' "$(frontend_url)"
  printf -- '- Admin:      %s\n' "$(admin_url)"
  printf -- '- POS:        %s\n' "$(pos_url)"
  printf -- '- API:        %s/health\n' "$GATEWAY_URL"
  printf -- '- RabbitMQ:   http://localhost:15672 (guest/guest)\n\n'
}

menu() {
  while true; do
    printf '\n===== Minh Giang Pharmacy Local =====\n'
    printf '1. Mo web khach hang\n'
    printf '2. Mo Admin\n'
    printf '3. Mo POS\n'
    printf '4. Hien thi cac duong dan\n'
    printf '5. Restart tat ca Docker services\n'
    printf '6. Test health tong\n'
    printf '7. Health tung service\n'
    printf '8. Xem logs api-gateway\n'
    printf '9. Chay test.sh (Kiem thu hop nhat)\n'
    printf '10. Stop Docker services\n'
    printf '11. Khoi tao/Reset Database (Che do SACH - Khong giao dich)\n'
    printf '12. Khoi tao/Reset Database (Che do DEMO - Day du giao dich)\n'
    printf '0. Thoat menu\n'
    printf 'Chon: '
    read -r choice

    case "$choice" in
      1) open_url "$(frontend_url)" ;;
      2) open_url "$(admin_url)" ;;
      3) open_url "$(pos_url)" ;;
      4) print_links ;;
      5) dc restart ;;
      6) health_all ;;
      7) health_menu ;;
      8) dc logs -f api-gateway ;;
      9) bash "$ROOT_DIR/test.sh" ;;
      10) dc down; stop_frontend ;;
      11) bash "$ROOT_DIR/infrastructure/database/run_clean.sh" ;;
      12) bash "$ROOT_DIR/infrastructure/database/run_all.sh" ;;
      0) break ;;
      *) printf 'Lua chon khong hop le.\n' ;;
    esac
  done
}

printf 'Dang khoi dong Docker services...\n'
dc up -d

printf '\nDang khoi dong frontend static server...\n'
start_frontend

print_links
health_all
menu
