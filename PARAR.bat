@echo off
setlocal
cd /d "%~dp0"
title My Series 3.0 - Encerrar
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\parar.ps1"
echo.
echo My Series foi encerrado. Seus dados continuam salvos.
exit /b 0
