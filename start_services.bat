@echo off
echo Iniciando MusicVerse...

REM Iniciar el servidor Node.js en una nueva ventana
start cmd /k "cd node-server && node server.js"

REM Iniciar el servidor Python en una nueva ventana
start cmd /k "cd python-api && python app.py"

REM Esperar un poco para que los servidores se inicien
timeout /t 2 /nobreak > nul

REM Iniciar la aplicación Next.js
echo Iniciando aplicación web...
npm run dev

echo Todos los servicios han sido iniciados.
pause 