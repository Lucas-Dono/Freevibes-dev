"""
Punto de entrada para la API de YouTube Music
"""
from flask import Flask, jsonify
from youtube_music_api import app
import traceback
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Comentamos esta configuración CORS porque ya está configurada en youtube_music_api.py
# if os.environ.get('CORS_ORIGIN'):
#     from flask_cors import CORS
#     cors_origin = os.environ.get('CORS_ORIGIN', '*').split(',')
#     CORS(app, resources={r"/*": {"origins": cors_origin}})

# Agregar una ruta raíz para verificación de disponibilidad
@app.route('/')
def root():
    """Endpoint raíz para verificar que el servicio está activo"""
    try:
        return jsonify({
            "status": "ok",
            "message": "YouTube Music Python API running",
            "service": "Python API",
            "environment": os.environ.get('FLASK_ENV', 'development')
        })
    except Exception as e:
        print(f"Error en endpoint raíz: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# Ruta de API explícita para verificaciones más específicas
@app.route('/api')
def api_root():
    """Endpoint API para verificar que el servicio está activo"""
    try:
        return jsonify({
            "status": "ok",
            "message": "YouTube Music API is running",
            "service": "Python API",
            "version": "1.0.0",
            "environment": os.environ.get('FLASK_ENV', 'development')
        })
    except Exception as e:
        print(f"Error en endpoint api: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == "__main__":
    try:
        # Obtener puerto desde variables de entorno (para Render)
        port = os.environ.get('PORT', 5000)
        debug = os.environ.get('FLASK_ENV', 'development') == 'development'
        
        print(f"Iniciando servidor YouTube Music API en http://0.0.0.0:{port}")
        print(f"Modo depuración: {debug}")
        print("Presiona Ctrl+C para detener el servidor")
        app.run(host='0.0.0.0', port=port, debug=debug)
    except KeyboardInterrupt:
        print("\nServidor detenido manualmente.")
    except Exception as e:
        print(f"Error al iniciar el servidor: {str(e)}")
        traceback.print_exc()
        input("Presiona Enter para salir...")  # Para evitar que la ventana se cierre inmediatamente 