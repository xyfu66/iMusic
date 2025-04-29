#!/bin/bash

# 加载 .env 文件中的环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 设置默认环境变量
export NODE_ENV=${NODE_ENV:-development}
export IS_ANDROID=${IS_ANDROID:-false}

# 根据环境设置 cloud-service 的 URL
if [ "$NODE_ENV" = "development" ]; then
    if [ "$IS_ANDROID" = "true" ]; then
        # Android 模拟器环境
        export NEXT_CLOUD_BACKEND_URL=${NEXT_CLOUD_BACKEND_URL:-http://10.0.2.2:8101}
    else
        # 本地开发环境
        export NEXT_CLOUD_BACKEND_URL=${NEXT_CLOUD_BACKEND_URL:-http://localhost:8101}
    fi
else
    # 生产环境
    export NEXT_CLOUD_BACKEND_URL=${NEXT_CLOUD_BACKEND_URL:-http://192.168.68.53:8101}
fi

# 启动 Python 服务
if [ "$NODE_ENV" = "development" ]; then
    # 开发环境
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8201
else
    # 生产环境
    uvicorn app.main:app --host 0.0.0.0 --port 8201
fi