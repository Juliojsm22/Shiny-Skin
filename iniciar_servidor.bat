@echo off
title SISCO - Shiny Skin (Servidor Web)
echo ========================================================
echo   SISCO - Shiny Skin (Concept Store ^& E-Commerce)
echo ========================================================
cd /d "%~dp0backend"

set PYTHON_CMD=python
if exist "C:\Users\julio\AppData\Local\Programs\Python\Python311\python.exe" (
    set PYTHON_CMD="C:\Users\julio\AppData\Local\Programs\Python\Python311\python.exe"
)

echo [1/2] Verificando dependencias de Python...
%PYTHON_CMD% -m pip install -r requirements.txt

echo [2/2] Iniciando servidor SISCO en http://localhost:5000 ...
start "" http://localhost:5000
%PYTHON_CMD% app.py
pause

