@echo off
echo Iniciando servidor de YouTube Music API...
cd python-api

REM Ejecutar Python en la misma ventana para mejor visibilidad
python app.py

REM Solo llegaremos aquí si el servidor termina
echo El servidor de YouTube Music API se ha detenido.
pause 