@echo off
setlocal
cd /d "%~dp0"
title Backup My Series
powershell -NoProfile -Command "$ports = Get-NetTCPConnection -LocalPort 5000,5173 -State Listen -ErrorAction SilentlyContinue; if ($ports) { exit 1 }"
if errorlevel 1 (
  echo O My Series ainda parece estar em execucao.
  echo Execute PARAR.bat e tente novamente.
  pause
  exit /b 1
)
if not exist "backend\instance\my_series.db" (
  echo Banco de dados nao encontrado em backend\instance\my_series.db
  echo Abra o My Series pelo menos uma vez antes de fazer o backup.
  pause
  exit /b 1
)
if not exist "backups" mkdir "backups"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set STAMP=%%i
copy /y "backend\instance\my_series.db" "backups\my_series_%STAMP%.db" >nul
if errorlevel 1 goto erro
if exist "backend\instance\my_series.db-wal" copy /y "backend\instance\my_series.db-wal" "backups\my_series_%STAMP%.db-wal" >nul
if exist "backend\instance\my_series.db-shm" copy /y "backend\instance\my_series.db-shm" "backups\my_series_%STAMP%.db-shm" >nul
echo.
echo Backup criado em:
echo %~dp0backups\my_series_%STAMP%.db
echo.
echo Guarde uma copia da pasta backups em outro local ou pendrive.
pause
exit /b 0
:erro
echo Falha ao copiar o banco. Feche o My Series e tente novamente.
pause
exit /b 1
