-- 创建用户（如果不存在）
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'imusicuser') THEN
      CREATE USER imusicuser WITH PASSWORD 'ipwd';
   END IF;
END
$do$;

-- 授予所有权限
ALTER USER imusicuser WITH SUPERUSER;
GRANT ALL PRIVILEGES ON DATABASE imusicdb TO imusicuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO imusicuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO imusicuser;