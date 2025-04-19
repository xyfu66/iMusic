#!/bin/bash

# 检查是否启用调试模式
if [ "$DEBUG" = "true" ]; then
    echo "Starting in debug mode..."
    python -m debugpy --listen 0.0.0.0:5678 --wait-for-client -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8101
else
    echo "Starting in production mode..."
    uvicorn app.main:app --host 0.0.0.0 --port 8101
fi