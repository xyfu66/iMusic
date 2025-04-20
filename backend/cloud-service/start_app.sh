#!/bin/sh

# 等待数据库就绪
wait_for_db() {
    echo "Waiting for database..."
    while ! nc -z postgres 5432; do
        sleep 1
    done
    echo "Database is ready!"
}

# 先等待数据库
wait_for_db

# 检查是否启用调试模式
case "$DEBUG" in
  "true")
    echo "Starting in debug mode..."
    python -m debugpy --listen 0.0.0.0:5678 --wait-for-client -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8101
    ;;
  *)
    echo "Starting in production mode..."
    uvicorn app.main:app --host 0.0.0.0 --port 8101
    ;;
esac