# 创建目标目录
$targetDir = "app/src/main/assets/python"
New-Item -ItemType Directory -Force -Path $targetDir
New-Item -ItemType Directory -Force -Path "$targetDir/tuner"

# 设置源目录路径
$sourceDir = "../../backend/device-service/app"

# 复制 Python 文件
Copy-Item "$sourceDir/*.py" -Destination $targetDir -ErrorAction SilentlyContinue
Copy-Item "$sourceDir/tuner/*.py" -Destination "$targetDir/tuner" -ErrorAction SilentlyContinue

Write-Host "Python files copied successfully to $targetDir" 