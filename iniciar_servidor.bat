@echo off
chcp 65001 >nul
title SISCO - Shiny Skin (Iniciador Universal)
echo ================================================================
echo   SISCO - Shiny Skin (Concept Store ^& E-Commerce Omnicanal)
echo ================================================================
cd /d "%~dp0"

set PYTHON_CMD=

:: Buscar Python instalado en cualquier PC (AppData local del usuario actual o PATH global)
for %%P in (
    "%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
) do (
    if exist %%P (
        set PYTHON_CMD=%%P
        goto :found_python
    )
)

py -3 -c "import sys" >nul 2>nul
if %errorlevel%==0 (
    set PYTHON_CMD=py -3
    goto :found_python
)

python -c "import sys" >nul 2>nul
if %errorlevel%==0 (
    set PYTHON_CMD=python
    goto :found_python
)

echo [AVISO] No se detecto Python en esta PC.
echo Abriendo SISCO directamente en el navegador con Base de Datos Local...
start "" "%~dp0frontend\index.html"
exit /b 0

:found_python
echo [1/2] Python detectado: %PYTHON_CMD%
echo Verificando librerias del backend...
cd /d "%~dp0backend"
%PYTHON_CMD% -m pip install -r requirements.txt --quiet

echo [2/2] Iniciando servidor SISCO en http://localhost:5000 ...
start "" http://localhost:5000
%PYTHON_CMD% app.py
pause
