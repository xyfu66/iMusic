# 使用 Node.js 官方镜像
FROM node:20
# 设置工作目录
WORKDIR /app
# 复制前端代码到容器中
COPY ./frontend /app

# 更新系统证书
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates

# 禁用 SSL 验证
RUN npm config set strict-ssl false

# 安装前端依赖
RUN npm install

# 创建环境变量文件
ENV PORT=50003
ENV NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000   

# 暴露端口
EXPOSE 50003
# 启动前端服务
CMD ["npm", "start"]