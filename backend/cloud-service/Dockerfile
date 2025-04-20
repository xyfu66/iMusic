# 使用官方 Python 镜像
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 安装必要的系统依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    fluidsynth \
    portaudio19-dev \
    alsa-utils \
    libasound2-dev \
    libasound2-plugins \
    build-essential \
    python3-dev \
    libffi-dev \
    libssl-dev \
    netcat-traditional && \
    update-ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 最后复制所有代码
COPY . /app
RUN chmod +x /app/start_app.sh

RUN pip install --upgrade pip setuptools wheel
# 安装 Python 依赖
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org -r requirements.txt


# 暴露端口
EXPOSE 8101 5678

# 启动命令
CMD ["sh", "-c", "./start_app.sh"]