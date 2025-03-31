@echo off
echo Iniciando servidor de YouTube Music API...

REM Activar el entorno virtual
call python-env\Scripts\activate.bat

REM Cambiar al directorio de la API
cd python-api

REM Ejecutar Python en la misma ventana para mejor visibilidad
python app.py

REM Solo llegaremos aquí si el servidor termina
echo El servidor de YouTube Music API se ha detenido.
pause 