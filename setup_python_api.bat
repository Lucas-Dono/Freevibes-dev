@echo off
echo Configurando el entorno para la API de YouTube Music...

REM Eliminar el entorno virtual anterior si existe
if exist python-env (
    echo Eliminando entorno virtual anterior...
    rmdir /S /Q python-env
)

REM Crear un nuevo entorno virtual con la ruta correcta
echo Creando nuevo entorno virtual...
python -m venv python-env

REM Activar el entorno virtual
echo Activando entorno virtual...
call python-env\Scripts\activate.bat

REM Instalar dependencias
echo Instalando dependencias...
cd python-api
pip install -r requirements.txt

echo.
echo ======================================================
echo Instalación completada. Ahora puedes ejecutar la API con:
echo start_python_server.bat
echo ======================================================
echo.

pause 