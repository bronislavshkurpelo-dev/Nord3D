@echo off
chcp 65001 > nul
title NORD 3D — Сервер презентации
color 0B

echo ===================================================================
echo   NORD 3D — Локальная фабрика 3D-печати в Норильске
echo ===================================================================
echo.
echo Запуск сервера на Node.js...
echo.

start "" "http://localhost:3000"
node server.js

pause
