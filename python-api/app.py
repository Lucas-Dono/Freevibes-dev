"""
Punto de entrada para la API de YouTube Music
"""

from flask import jsonify
from youtube_music_api import app
import traceback
import os
from dotenv import load_dotenv
from flask_cors import CORS

# Cargar variables de entorno
load_dotenv()

# Configuración CORS independiente
cors_origin_string = os.environ.get("CORS_ORIGIN", "")
allowed_origins = []

# En producción, esta variable debe configurarse explícitamente
if cors_origin_string == "*":
    allowed_origins = "*"
elif cors_origin_string:
    # Usar la configuración CORS explícita
    allowed_origins = [origin.strip() for origin in cors_origin_string.split(",") if origin.strip()]
else:
    # Si no hay configuración CORS, usar valor por defecto para desarrollo
    print("ADVERTENCIA: No se ha configurado CORS_ORIGIN. Usando configuración por defecto para desarrollo.")
    allowed_origins = ["*"]  # En desarrollo permitir todos los orígenes

# Aplicar configuración CORS
CORS(app, origins=allowed_origins, supports_credentials=True)
print(f"CORS configurado con orígenes permitidos: {allowed_origins}")

# Agregar una ruta raíz para verificación de disponibilidad
@app.route("/")
def root():
    """Endpoint raíz para verificar que el servicio está activo"""
    try:
        return jsonify(
            {
                "status": "ok",
                "message": "YouTube Music Python API running",
                "service": "Python API",
                "environment": os.environ.get("FLASK_ENV", "development"),
                "cors_origins": allowed_origins,
            }
        )
    except Exception as e:
        print(f"Error en endpoint raíz: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


# Ruta de API explícita para verificaciones más específicas
@app.route("/api")
def api_root():
    """Endpoint API para verificar que el servicio está activo"""
    try:
        return jsonify(
            {
                "status": "ok",
                "message": "YouTube Music API is running",
                "service": "Python API",
                "version": "1.0.0",
                "environment": os.environ.get("FLASK_ENV", "development"),
                "cors_origins": allowed_origins,
            }
        )
    except Exception as e:
        print(f"Error en endpoint api: {str(e)}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    try:
        # Configuración del puerto
        # 1. Primero intentar con variable PORT específica
        port = os.environ.get("PORT")
        
        # 2. Si no hay PORT específico, intentar usar variable PYTHON_API_PORT
        if not port:
            port = os.environ.get("PYTHON_API_PORT")
            
        # 3. Valor por defecto para desarrollo
        if not port:
            port = 5200  # Puerto por defecto para desarrollo
            print(f"ADVERTENCIA: No se ha configurado PORT o PYTHON_API_PORT. Usando puerto {port} por defecto.")
        
        # Convertir a entero
        try:
            port = int(port)
        except (ValueError, TypeError):
            print(f"Error al convertir puerto '{port}' a entero, usando 5200")
            port = 5200
            
        # Configuración adicional
        host = os.environ.get("HOST", "0.0.0.0")  # Por defecto escuchar en todas las interfaces
        debug = os.environ.get("FLASK_ENV", "development") == "development"

        print(f"Iniciando servidor YouTube Music API en http://{host}:{port}")
        print(f"Modo depuración: {debug}")
        print("Presiona Ctrl+C para detener el servidor")
        
        # Iniciar servidor
        app.run(host=host, port=port, debug=debug)
    except KeyboardInterrupt:
        print("\nServidor detenido manualmente.")
    except Exception as e:
        print(f"Error al iniciar el servidor: {str(e)}")
        traceback.print_exc()
        input("Presiona Enter para salir...")  # Para evitar que la ventana se cierre inmediatamente
