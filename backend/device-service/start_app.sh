#!/bin/bash

# 开发环境
export APP_ENV=development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8201

# # 生产环境
# export APP_ENV=production
# uvicorn app.main:app --host 0.0.0.0 --port 8201