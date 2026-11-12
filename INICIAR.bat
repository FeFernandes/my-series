@echo off
setlocal
cd /d "%~dp0"
title My Series 3.0 - Inicializador
color 0B

echo =====================================
echo          MY SERIES 3.0
echo =====================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale Python 3.11 ou superior:
  echo https://www.python.org/downloads/
  echo Marque a opcao Add Python to PATH durante a instalacao.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao LTS:
  echo https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm nao encontrado. Reinstale o Node.js LTS.
  pause
  exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
  echo Preparando ambiente Python na primeira execucao...
  python -m venv backend\.venv
  if errorlevel 1 goto erro
)
"backend\.venv\Scripts\python.exe" -c "import flask, requests" >nul 2>nul
if errorlevel 1 (
  echo Instalando dependencias Python pela primeira vez...
  "backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
  if errorlevel 1 goto erro
)
if not exist "frontend\package-lock.json" (
  echo Preparando dependencias da interface pela primeira vez...
  pushd frontend
  call npm install
  if errorlevel 1 (popd & goto erro)
  popd
)
if not exist "frontend\node_modules\vite" (
  echo Restaurando dependencias da interface...
  pushd frontend
  call npm ci
  if errorlevel 1 (popd & goto erro)
  popd
)

if not exist ".runtime" mkdir ".runtime"
if exist ".runtime\backend.pid" call PARAR.bat >nul 2>nul

echo Iniciando My Series...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar.ps1"
if errorlevel 1 goto erro

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"
echo.
echo My Series iniciado!
echo Para acessar pelo celular, use o endereco IP deste computador
echo seguido de :5173, conectado a mesma rede Wi-Fi.
echo Para encerrar, clique duas vezes em PARAR.bat.
echo.
exit /b 0

:erro
echo.
echo Nao foi possivel iniciar o My Series. Confira as mensagens acima.
pause
exit /b 1
