from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from datetime import datetime, timedelta
import logging
from ytmusicapi import YTMusic
import time
import threading
import ssl
from pprint import pprint
import random
from functools import wraps
import re
import pickle
import hashlib
import traceback

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('youtube-music-api')

app = Flask(__name__)

# Configuración CORS más específica
cors_origin = os.environ.get('CORS_ORIGIN', '*')
if cors_origin and ',' in cors_origin:
    # Si hay múltiples orígenes, usar el primero
    cors_origin = cors_origin.split(',')[0].strip()
CORS(app, resources={r"/*": {"origins": cors_origin}})
logger.info(f"CORS configurado con origen: {cors_origin}")

# Configuración y autenticación
AUTH_FILE = "browser.json"

# Caché para almacenar resultados y reducir llamadas a la API
CACHE_DIR = "cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# Inicialización perezosa de YTMusic
yt_music = None

# Variables globales para cacheo y autenticación
setup_auth_lock = threading.Lock()
cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
os.makedirs(cache_dir, exist_ok=True)

# Duración del caché en segundos
CACHE_DURATION = 3600  # 1 hora

# Estado del servicio (para monitoreo)
service_status = {
    "ytmusic_available": False,
    "last_check": datetime.now().isoformat(),
    "initialization_attempts": 0,
    "last_successful_operation": None,
    "errors": []
}

# Decorador para caché


def cached(cache_file):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Obtener la región si está presente en los args de request
            region = request.args.get('region', 'default')
            # Crear nombre de caché específico para la región
            region_cache_file = f"{region}_{cache_file}"
            cache_path = os.path.join(CACHE_DIR, region_cache_file)

            try:
                # Verificar si existe un caché válido
                if os.path.exists(cache_path):
                    with open(cache_path, 'r') as f:
                        cached_data = json.load(f)

                    # Verificar si el caché está vigente
                    if time.time() - cached_data.get('timestamp', 0) < CACHE_DURATION:
                        logger.info(
                            f"Usando caché para {
                                func.__name__} con región {region}")
                        # Importante: devolver como jsonify para que sea una
                        # respuesta válida
                        return jsonify(cached_data.get('data'))

                # Si no hay caché o expiró, ejecutar función
                result = func(*args, **kwargs)

                # Extraer los datos JSON si es una respuesta Flask
                if hasattr(result, 'get_json'):
                    data_to_cache = result.get_json()
                else:
                    data_to_cache = result

                # Guardar en caché
                with open(cache_path, 'w') as f:
                    json.dump({
                        'timestamp': time.time(),
                        'data': data_to_cache
                    }, f)

                return result
            except Exception as e:
                logger.error(f"Error en caché para {func.__name__}: {str(e)}")
                # Si hay un error en la caché, intentar ejecutar la función
                # directamente
                return func(*args, **kwargs)
        return wrapper
    return decorator


def get_ytmusic():
    global yt_music
    if yt_music is None:
        logger.info("Inicializando YTMusic...")
        try:
            yt_music = YTMusic()
            logger.info("YTMusic inicializado correctamente")
        except Exception as e:
            logger.error(f"Error al inicializar YTMusic: {str(e)}")
            raise e
    return yt_music


def get_cached(key, ttl_hours=24):
    """Obtiene resultados cacheados si existen y no han expirado"""
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")

    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if datetime.fromisoformat(data['timestamp']) + timedelta(hours=ttl_hours) > datetime.now():
                    return data['content']
        except UnicodeDecodeError:
            # Si hay un error de decodificación, intentar eliminar el archivo
            try:
                os.remove(cache_file)
                logger.warning(f"Archivo de caché dañado eliminado: {cache_file}")
            except BaseException:
                pass
        except Exception as e:
            logger.warning(f"Error leyendo caché para {key}: {str(e)}")

    return None


def save_to_cache(key, content):
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'content': content
            }, f, ensure_ascii=False)
            logger.debug(f"Datos guardados en caché: {key}")
    except Exception as e:
        logger.error(f"Error guardando caché para {key}: {str(e)}")
        # Intentar eliminar el archivo si existe y hay error al escribir
        try:
            if os.path.exists(cache_file):
                os.remove(cache_file)
        except BaseException:
            pass


def get_cache_file_path(key):
    """Genera una ruta de archivo para la clave de caché dada"""
    # Convertir la clave a un nombre de archivo válido
    cache_key = key.replace('/', '_').replace('?', '_').replace('=', '_')
    return os.path.join(cache_dir, f"{cache_key}.json")


def get_cached_results(key):
    """Obtiene resultados cacheados si existen y no han expirado"""
    cache_file = get_cache_file_path(key)

    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)

            # Verificar si el caché ha expirado
            cache_time = cached_data.get('timestamp', 0)
            if time.time() - cache_time < CACHE_DURATION:
                print(f"Cache hit para {key}")
                return cached_data.get('data')
            else:
                print(f"Cache expirado para {key}")
        except Exception as e:
            print(f"Error leyendo caché para {key}: {e}")

    return None


def get_best_thumbnail(thumbnails):
    """Obtiene la mejor calidad de thumbnail disponible"""
    default_thumbnail = 'https://img.youtube.com/vi/default/hqdefault.jpg'

    # Validar entrada
    if not thumbnails or not isinstance(thumbnails, list):
        logger.debug("[DEBUG-THUMBNAIL] Sin miniaturas disponibles para procesar")
        return default_thumbnail

    # Log detallado de la entrada
    logger.info(f"[DEBUG-THUMBNAIL] Procesando thumbnails: {json.dumps(thumbnails[:2], indent=2, ensure_ascii=False)}")

    # Filtrar y ordenar miniaturas por tamaño (width * height) de mayor a menor
    valid_thumbnails = []
    for t in thumbnails:
        if isinstance(t, dict) and 'url' in t:
            # Si tiene dimensiones, usarlas para ordenar
            if 'width' in t and 'height' in t:
                valid_thumbnails.append(t)
            # Si no tiene dimensiones pero tiene URL, también incluirla
            else:
                valid_thumbnails.append(t)

    logger.info(f"[DEBUG-THUMBNAIL] Thumbnails válidos: {len(valid_thumbnails)}")

    # Ordenar las miniaturas que tienen dimensiones (las mejores primero)
    sorted_thumbnails = sorted(
        [t for t in valid_thumbnails if 'width' in t and 'height' in t],
        key=lambda x: x['width'] * x['height'],
        reverse=True
    )

    # Preparar URL para devolver
    thumbnail_url = ""

    # Intentar obtener la mejor miniatura disponible
    if sorted_thumbnails:
        thumbnail_url = sorted_thumbnails[0]['url']
        logger.info(f"[DEBUG-THUMBNAIL] Usando miniatura ordenada: {thumbnail_url}")
    elif valid_thumbnails:
        thumbnail_url = valid_thumbnails[0]['url']
        logger.info(f"[DEBUG-THUMBNAIL] Usando primera miniatura válida: {thumbnail_url}")
    else:
        logger.warning("[DEBUG-THUMBNAIL] No se encontraron URLs válidas en las miniaturas")
        return default_thumbnail

    # Validar y corregir la URL
    if not thumbnail_url:
        logger.warning("[DEBUG-THUMBNAIL] URL de miniatura vacía")
        return default_thumbnail

    # --- Añadir esta lógica de modificación de URL ---
    try:
        # Intentar reemplazar los parámetros de tamaño por unos de mayor resolución
        modified_url = re.sub(r'(=w)\d+(-h)\d+.*$', r'=w544-h544-l90-rj', thumbnail_url)
        if modified_url != thumbnail_url:
            thumbnail_url = modified_url
            logger.info(f"[DEBUG-THUMBNAIL] URL modificada para mayor resolución: {thumbnail_url}")
        else:
            base_url = thumbnail_url.split('=')[0]
            if base_url != thumbnail_url: # Si había un '='
                 thumbnail_url = base_url
                 logger.info(f"[DEBUG-THUMBNAIL] URL modificada quitando parámetros: {thumbnail_url}")
    except Exception as e:
        logger.warning(f"[DEBUG-THUMBNAIL] No se pudo modificar la URL del thumbnail: {e}")
    # --- Fin de la lógica de modificación ---

    # Asegurar que la URL use HTTPS
    if thumbnail_url.startswith('http:'):
        thumbnail_url = thumbnail_url.replace('http:', 'https:')
        logger.info(f"[DEBUG-THUMBNAIL] Convertida URL a HTTPS: {thumbnail_url}")

    # Verificar si es una URL relativa y convertirla a absoluta si es necesario
    if not thumbnail_url.startswith(('http://', 'https://')):
        if thumbnail_url.startswith('//'):
            thumbnail_url = 'https:' + thumbnail_url
            logger.info(f"[DEBUG-THUMBNAIL] Convertida URL relativa a absoluta: {thumbnail_url}")
        else:
            logger.warning(f"[DEBUG-THUMBNAIL] URL de miniatura inválida: {thumbnail_url}")
            return default_thumbnail

    logger.info(f"[DEBUG-THUMBNAIL] URL final de miniatura: {thumbnail_url}")
    return thumbnail_url


def normalize_track_data(track, default_artist=''):
    """
    Normaliza los datos de una pista para garantizar consistencia en la estructura.
    Extrae el nombre del artista de manera robusta desde diferentes fuentes posibles.
    """
    if not track:
        logger.warning("[DEBUG-NORMALIZE] Se recibió un objeto track nulo o vacío")
        return None

    # Loggear los datos de entrada para depuración
    logger.info(f"[DEBUG-NORMALIZE] Normalizando track: {track.get('title', 'Sin título')}")

    # ID del video es obligatorio
    original_track_id = track.get('videoId', '')
    track_id = original_track_id
    logger.info(f"[DEBUG-NORMALIZE] ID de video original: '{track_id}'")

    # Validar ID del video
    if not track_id:
        # Buscar en campo 'id' como alternativa
        if 'id' in track and track['id'] and track['id'] != 'default' and len(track['id']) > 5:
            track_id = track['id']
            logger.info(f"[DEBUG-NORMALIZE] Usando 'id' alternativo: {track_id}")
        else:
            logger.warning(f"[DEBUG-NORMALIZE] ID de video vacío para track: {track.get('title', 'Sin título')}")
            # No rechazamos el track aquí para poder seguir procesando otros datos

    # Verificar si el ID es "default" o un valor no válido
    if track_id == 'default' or (track_id and len(track_id) < 5):
        logger.warning(f"[DEBUG-NORMALIZE] ID de video inválido: '{track_id}' para track: {track.get('title', 'Sin título')}")

        # Intentar buscar un ID alternativo en otros campos
        if 'id' in track and track['id'] and track['id'] != 'default' and track['id'] != track_id and len(track['id']) > 5:
            track_id = track['id']
            logger.info(f"[DEBUG-NORMALIZE] Usando ID alternativo 'id': {track_id}")
        elif 'browseId' in track and track['browseId'] and track['browseId'] != 'default' and len(track['browseId']) > 5:
            track_id = track['browseId']
            logger.info(f"[DEBUG-NORMALIZE] Usando ID alternativo 'browseId': {track_id}")
        # Buscar en cualquier otro campo que parezca un ID
        else:
            for key, value in track.items():
                if isinstance(value, str) and 'id' in key.lower() and value != 'default' and len(value) > 5:
                    track_id = value
                    logger.info(f"[DEBUG-NORMALIZE] Usando ID alternativo '{key}': {track_id}")
                    break

        # Verificar si finalmente tenemos un ID válido
        if track_id == 'default' or not track_id or len(track_id) < 5:
            logger.warning(f"[DEBUG-NORMALIZE] No se encontró un ID alternativo válido. Usando un ID generado.")
            # Generar un ID basado en título y artista para garantizar que haya un valor
            title_str = track.get('title', 'unknown')
            artist_str = track.get('artist', track.get('author', 'unknown'))
            track_id = f"gen_{hash(title_str + artist_str) % 10000000:07d}"
            logger.info(f"[DEBUG-NORMALIZE] ID generado: {track_id}")

    # Obtener el título con valor predeterminado
    title = track.get('title', 'Sin título')

    # Extraer el artista de manera robusta desde diferentes posibles campos
    artist = ''

    # Estructura para registrar la fuente del artista (debug)
    artist_source = "ninguna"

    # 1. Primero intentar con el campo 'artists' que es el más completo
    if 'artists' in track and isinstance(
        track['artists'], list) and track['artists']:
        for artist_obj in track['artists']:
            if isinstance(
                artist_obj, dict) and 'name' in artist_obj and artist_obj['name']:
                artist = artist_obj['name']
                artist_source = "artists[].name"
                break

    # 2. Si no hay 'artists', intentar con 'artist'
    if not artist and 'artist' in track and track['artist']:
        artist = track['artist']
        artist_source = "artist"

    # 3. Si no hay 'artist', intentar con 'author'
    if not artist and 'author' in track and track['author']:
        artist = track['author']
        artist_source = "author"

    # 4. Intentar con campo 'authors'
    if not artist and 'authors' in track and isinstance(
        track['authors'], list) and track['authors']:
        for author_obj in track['authors']:
            if isinstance(
                author_obj, dict) and 'name' in author_obj and author_obj['name']:
                artist = author_obj['name']
                artist_source = "authors[].name"
                break

    # 5. Verificar si hay un campo artistInfo
    if not artist and 'artistInfo' in track:
        if isinstance(track['artistInfo'],
                      dict) and 'artist' in track['artistInfo']:
            artist = track['artistInfo']['artist']
            artist_source = "artistInfo.artist"

    # 6. Si todavía no hay artista, intentar buscar en cualquier otra
    # estructura
    if not artist:
        # Buscar cualquier campo que contenga 'artist' en su nombre
        for key in track.keys():
            if 'artist' in key.lower() and track[key] and isinstance(
                track[key], str):
                artist = track[key]
                artist_source = f"campo_{key}"
                break

    # 7. Si no se encontró ningún campo de artista, usar el valor
    # predeterminado
    if not artist:
        if default_artist:
            artist = default_artist
            artist_source = "default_artist"
        else:
            artist = 'Artista desconocido'
            artist_source = "valor_predeterminado"

    # Depuración detallada para comprender la estructura de datos
    logger.debug(
    f"[NORMALIZE] Track: '{title}' | Artist: '{artist}' | Fuente: {artist_source}")

    # Extraer la mejor imagen o usar URL predeterminada de YouTube basada en
    # el ID del video
    thumbnail = get_best_thumbnail(track.get('thumbnails', []))

    # Verificar si tenemos una URL de miniatura válida
    has_valid_thumbnail = thumbnail and isinstance(thumbnail, str) and len(
        thumbnail) > 10 and 'default' not in thumbnail

    if not has_valid_thumbnail:
        # Si no hay thumbnail o no es válida, intentar con otros campos de
        # imágenes
        logger.info(f"[DEBUG-NORMALIZE] Thumbnail no válida: {thumbnail}")

        # Probar diferentes fuentes de imágenes
        alternative_thumbnails = []

        # 1. Verificar si hay un campo 'thumbnail' directo
        if 'thumbnail' in track and isinstance(
            track['thumbnail'], str) and len(track['thumbnail']) > 10:
            alternative_thumbnails.append(
    ('campo_thumbnail', track['thumbnail']))

        # 2. Verificar si hay un campo 'cover'
        if 'cover' in track and isinstance(
            track['cover'], str) and len(track['cover']) > 10:
            alternative_thumbnails.append(('campo_cover', track['cover']))

        # 3. Verificar si hay un campo 'albumArt'
        if 'albumArt' in track and isinstance(
            track['albumArt'], str) and len(track['albumArt']) > 10:
            alternative_thumbnails.append(
    ('campo_albumArt', track['albumArt']))

        # 4. Buscar cualquier campo que parezca contener una URL de imagen
        for key, value in track.items():
            if isinstance(value, str) and ('image' in key.lower(
            ) or 'thumbnail' in key.lower() or 'cover' in key.lower()):
                if value.startswith('http') and len(value) > 10:
                    alternative_thumbnails.append((f'campo_{key}', value))

        # Usar la primera alternativa válida que encontremos
        if alternative_thumbnails:
            source, value = alternative_thumbnails[0]
            logger.info(
    f"[DEBUG-NORMALIZE] Usando miniatura alternativa de {source}: {value}")
            thumbnail = value
        # Si no hay alternativas pero tenemos un ID válido, generar URL de
        # miniatura de YouTube
        elif track_id and track_id != 'default':
            thumbnail = f'https://img.youtube.com/vi/{track_id}/hqdefault.jpg'
            logger.info(
    f"[DEBUG-NORMALIZE] Creando URL de miniatura basada en ID: {thumbnail}")

    # Verificar si la URL de la miniatura contiene "default"
    if 'default' in thumbnail and track_id != 'default':
        logger.warning(
    f"[DEBUG-NORMALIZE] URL de miniatura contiene 'default' cuando el ID no debería ser 'default': {thumbnail}")
        # Corregir URL si es necesario
        thumbnail = f'https://img.youtube.com/vi/{track_id}/hqdefault.jpg'
        logger.info(
    f"[DEBUG-NORMALIZE] URL de miniatura corregida: {thumbnail}")

    # Crear y devolver objeto de datos normalizado
    normalized_track = {
        'id': track_id,
        'title': title,
        'artist': artist,
        'thumbnail': thumbnail,
        'duration': track.get('duration', track.get('length', '')),
        'source': track.get('source', 'youtube_music')
    }

    logger.info(
    f"[DEBUG-NORMALIZE] Track normalizado: ID={track_id}, Título={title}, Artista={artist}, Thumbnail={thumbnail}")
    return normalized_track


def setup_ytmusic_auth():
    """Configura la autenticación para YTMusic"""
    global yt_music

    try:
        # Obtener la región de la solicitud actual (si estamos en un contexto
        # de solicitud)
        region = None
        try:
            if request:
                region = request.args.get('region', 'US')
        except BaseException:
            # Si no estamos en un contexto de solicitud, usamos el valor
            # predeterminado
            pass

        # Si ya tenemos una instancia y la región coincide, la reutilizamos
        if yt_music and hasattr(
                yt_music, 'region') and yt_music.region == region:
            return yt_music

        # Caso contrario, creamos una nueva instancia
        if AUTH_FILE and os.path.exists(AUTH_FILE):
            # Usar archivo de autenticación si existe
            yt_music = YTMusic(AUTH_FILE, language=region)
        else:
            # Usar autenticación básica sin credenciales
            yt_music = YTMusic(language=region)

        # Guardar la región utilizada
        yt_music.region = region

        logger.info(f"YTMusic configurado correctamente con región: {region}")
        return yt_music
    except Exception as e:
        logger.error(f"Error en setup_auth: {str(e)}")
        # Fallback a crear una instancia simple sin autenticación
        yt_music = YTMusic(language=region)
        return yt_music


@app.route('/api/setup', methods=['POST'])
def setup_auth():
    """Configura la autenticación con headers proporcionados"""
    headers_raw = request.json.get('headers', '')
    try:
        # En producción usaríamos ytmusicapi
        # from ytmusicapi import setup
        # auth_json = setup(headers_raw=headers_raw)
        auth_json = '{"user": "authenticated"}'  # Simulamos para desarrollo
        with open(AUTH_FILE, 'w', encoding='utf-8') as f:
            f.write(auth_json)
        return jsonify({"success": True,
                        "message": "Autenticación configurada correctamente"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/search', methods=['GET'])
def search():
    """Busca tracks, albums, artistas, playlists en YouTube Music"""
    try:
        query = request.args.get('query', '')
        # Tipo de búsqueda: songs, albums, artists, playlists
        filter_type = request.args.get('filter', 'songs')
        limit = int(request.args.get('limit', 10))
        # Región por defecto Estados Unidos
        region = request.args.get('region', 'US')
        language = request.args.get(
            'language', 'en')  # Idioma por defecto inglés

        # Lista de idiomas soportados por YouTube Music
        supported_languages = ['de', 'fr', 'pt', 'zh_CN', 'hi', 'ar',
                               'tr', 'zh_TW', 'ja', 'ko', 'es', 'nl', 'ru', 'ur', 'en', 'it']

        # Asegurarse de usar un idioma soportado
        if language not in supported_languages:
            logger.warning(
                f"Idioma '{language}' no soportado. Usando 'en' como fallback.")
            language = 'en'  # Usar inglés como fallback

        if not query:
            return jsonify({'error': 'Se requiere parámetro query'}), 400

        logger.info(
            f"Búsqueda en YouTube Music: {query} (filtro: {filter_type}, límite: {limit}, región: {region}, idioma: {language})")

        # Configurar YTMusic con la región e idioma específicos
        try:
            music = YTMusic(language=language)

            # Realizar la búsqueda
            start_time = time.time()
            search_results = music.search(
                query, filter=filter_type, limit=limit)
            elapsed = time.time() - start_time
            logger.info(
                f"Búsqueda completada en {
                    elapsed:.2f}s, resultados: {
            len(search_results) if search_results else 0}")

            if search_results and len(search_results) > 0:
                # Transformar los resultados
                transformed_results = []

                for item in search_results:
                    # Para búsqueda de canciones/videos
                    if filter_type.lower() in ['songs', 'videos'] and item.get('resultType', '').lower() in ['song', 'video']:
                        track_data = {
                            'id': item.get('videoId', ''),
                            'title': item.get('title', 'Sin título'),
                            'artist': item.get('artists', [{'name': 'Artista desconocido'}])[0].get('name', 'Artista desconocido'),
                            'thumbnail': get_best_thumbnail(item.get('thumbnails', [])),
                            'album': item.get('album', {}).get('name', '') if item.get('album') else '',
                            'duration': item.get('duration', ''),
                            'region': region,  # Incluir la región en la respuesta
                            'language': language  # Incluir el idioma usado
                        }
                        transformed_results.append(track_data)
                    # Para búsqueda de artistas
                    elif filter_type.lower() == 'artists' and item.get('resultType', '').lower() == 'artist':
                        artist_data = {
                            'browseId': item.get('browseId', ''),
                            'title': item.get('title', 'Sin nombre'),
                            'name': item.get('title', 'Sin nombre'),  # Duplicado para compatibilidad
                            'thumbnails': item.get('thumbnails', []),
                            'region': region,
                            'language': language
                        }
                        transformed_results.append(artist_data)
                    # Para búsqueda de álbumes
                    elif filter_type.lower() == 'albums' and item.get('resultType', '').lower() == 'album':
                        album_data = {
                            'browseId': item.get('browseId', ''),
                            'title': item.get('title', 'Sin título'),
                            'thumbnails': item.get('thumbnails', []),
                            'artist': item.get('artists', [{'name': 'Artista desconocido'}])[0].get('name', 'Artista desconocido') if item.get('artists') else 'Artista desconocido',
                            'year': item.get('year', ''),
                            'region': region,
                            'language': language
                        }
                        transformed_results.append(album_data)

                logger.info(f"Búsqueda de {filter_type} completada, enviando {len(transformed_results)} resultados")

                return jsonify(transformed_results)
            else:
                logger.warning(f"No se encontraron resultados para: {query}")
                return jsonify([])
        except Exception as e:
            logger.error(
                f"Error al realizar la búsqueda con idioma {language}: {
                    str(e)}")
            # Intentar con inglés como idioma de fallback si no es el que ya
            # estamos usando
            if language != 'en':
                try:
                    logger.info(
                        f"Intentando búsqueda con idioma inglés para: {query}")
                    music_fallback = YTMusic(language='en')
                    search_results = music_fallback.search(
                        query, filter=filter_type, limit=limit)

                    if search_results and len(search_results) > 0:
                        # Transformar los resultados igual que antes
                        transformed_results = []

                        for item in search_results:
                            # Para búsqueda de canciones/videos
                            if filter_type.lower() in ['songs', 'videos'] and item.get('resultType', '').lower() in ['song', 'video']:
                                track_data = {
                                    'id': item.get('videoId', ''),
                                    'title': item.get('title', 'Sin título'),
                                    'artist': item.get('artists', [{'name': 'Artista desconocido'}])[0].get('name', 'Artista desconocido'),
                                    'thumbnail': get_best_thumbnail(item.get('thumbnails', [])),
                                    'album': item.get('album', {}).get('name', '') if item.get('album') else '',
                                    'duration': item.get('duration', ''),
                                    'region': region,
                                    'language': 'en'  # Indicar que se usó inglés como fallback
                                }
                                transformed_results.append(track_data)
                            # Para búsqueda de artistas
                            elif filter_type.lower() == 'artists' and item.get('resultType', '').lower() == 'artist':
                                artist_data = {
                                    'browseId': item.get('browseId', ''),
                                    'title': item.get('title', 'Sin nombre'),
                                    'name': item.get('title', 'Sin nombre'),  # Duplicado para compatibilidad
                                    'thumbnails': item.get('thumbnails', []),
                                    'region': region,
                                    'language': 'en'  # Fallback en inglés
                                }
                                transformed_results.append(artist_data)
                            # Para búsqueda de álbumes
                            elif filter_type.lower() == 'albums' and item.get('resultType', '').lower() == 'album':
                                album_data = {
                                    'browseId': item.get('browseId', ''),
                                    'title': item.get('title', 'Sin título'),
                                    'thumbnails': item.get('thumbnails', []),
                                    'artist': item.get('artists', [{'name': 'Artista desconocido'}])[0].get('name', 'Artista desconocido') if item.get('artists') else 'Artista desconocido',
                                    'year': item.get('year', ''),
                                    'region': region,
                                    'language': 'en'  # Fallback en inglés
                                }
                                transformed_results.append(album_data)
                        
                        logger.info(f"Búsqueda de fallback en {filter_type} completada, enviando {len(transformed_results)} resultados")

                        return jsonify(transformed_results)
                    else:
                        logger.warning(
                            f"No se encontraron resultados en el fallback para: {query}")
                        return jsonify([])
                except Exception as fallback_error:
                    logger.error(
                        f"Error también en la búsqueda con idioma inglés: {
                            str(fallback_error)}")
                    return jsonify([])
            else:
                # Si ya estábamos usando inglés y falló, intentar sin
                # especificar idioma
                try:
                    logger.info(
                        f"Intentando búsqueda sin especificar idioma para: {query}")
                    music_fallback = YTMusic()
                    search_results = music_fallback.search(
                        query, filter=filter_type, limit=limit)

                    if search_results and len(search_results) > 0:
                        # Transformar los resultados igual que antes
                        transformed_results = []

                        for item in search_results:
                            # Para búsqueda de canciones/videos
                            if filter_type.lower() in ['songs', 'videos'] and item.get('resultType', '').lower() in ['song', 'video']:
                                track_data = {
                                    'id': item.get('videoId', ''),
                                    'title': item.get('title', 'Sin título'),
                                    'artist': item.get('artists', [{'name': 'Artista desconocido'}])[0].get('name', 'Artista desconocido'),
                                    'thumbnail': get_best_thumbnail(item.get('thumbnails', [])),
                                    'album': item.get('album', {}).get('name', '') if item.get('album') else '',
                                    'duration': item.get('duration', ''),
                                    'region': 'global',
                                    'language': 'default'  # Indicar que se usó la configuración predeterminada
                                }
                                transformed_results.append(track_data)
                            # Para búsqueda de artistas
                            elif filter_type.lower() == 'artists' and item.get('resultType', '').lower() == 'artist':
                                artist_data = {
                                    'browseId': item.get('browseId', ''),
                                    'title': item.get('title', 'Sin nombre'),
                                    'name': item.get('title', 'Sin nombre'),  # Duplicado para compatibilidad
                                    'thumbnails': item.get('thumbnails', []),
                                    'region': 'global',
                                    'language': 'default'  # Fallback en inglés
                                }
                                transformed_results.append(artist_data)
                            # Para búsqueda de álbumes
                            elif filter_type.lower() == 'albums' and item.get('resultType', '').lower() == 'album':
                                album_data = {
                                    'browseId': item.get('browseId', ''),
                                    'title': item.get('title', 'Sin título'),
                                    'thumbnails': item.get('thumbnails', []),
                                    'artist': item.get('artists', [{'name': 'Artista desconocido'}])[0].get('name', 'Artista desconocido') if item.get('artists') else 'Artista desconocido',
                                    'year': item.get('year', ''),
                                    'region': 'global',
                                    'language': 'default'  # Fallback en inglés
                                }
                                transformed_results.append(album_data)
                        
                        logger.info(f"Búsqueda de fallback en {filter_type} completada, enviando {len(transformed_results)} resultados")

                        return jsonify(transformed_results)
                    else:
                        logger.warning(
                            f"No se encontraron resultados en el fallback para: {query}")
                        return jsonify([])
                except Exception as fallback_error:
                    logger.error(
                        f"Error también en la búsqueda de fallback: {
                            str(fallback_error)}")
                    return jsonify([])
    except Exception as e:
        logger.error(f"Error general en endpoint search: {str(e)}")
        return jsonify([])


@app.route('/api/find-track', methods=['GET'])
def find_track():
    """Encuentra un track por título y artista"""
    title = request.args.get('title', '')
    artist = request.args.get('artist', '')
    query = request.args.get('query', f"{title} {artist}").strip()

    if not query:
        return jsonify({
            'id': '',
            'title': '',
            'artist': '',
            'error': 'Se requiere una consulta'
        }), 400

    # Verificar caché
    cache_key = f"find_track_{query.replace(' ', '_')}"
    cached_track = get_cached(cache_key, ttl_hours=24 * 7)  # 1 semana
    if cached_track:
        logger.info(f"[RASTREO-PLAYLIST] Usando caché para: '{query}'")
        return jsonify(cached_track)

    try:
        # Configuración regional
        region = request.args.get('region', 'US')
        language = request.args.get('language', 'en')

        logger.info(
    f"[RASTREO-PLAYLIST] Configuración: region={region}, language={language}")

        start_time = time.time()
        music = YTMusic(language=language)

        # Buscar con tipo "songs" y límite pequeño
        logger.info(
    f"[RASTREO-PLAYLIST] Ejecutando búsqueda con params: query='{query}', filter='songs', limit=5")
        search_results = music.search(query, filter="songs", limit=5)
        search_duration = time.time() - start_time

        # Loguear información sobre los resultados
        if search_results:
            logger.info(f"[RASTREO-PLAYLIST] ÉXITO: {len(search_results)} resultados en {search_duration:.2f}s")
            logger.info(f"[RASTREO-PLAYLIST] Primer resultado: " +
                        f"title='{search_results[0].get('title', '')}', " +
                        f"artist='{search_results[0].get('artists', [{'name': 'Desconocido'}])[0].get('name', 'Desconocido')}'")
        else:
            logger.warning(f"[RASTREO-PLAYLIST] Sin resultados para query='{query}' en {search_duration:.2f}s")

        if search_results and len(search_results) > 0:
            # Tomar el primer resultado como el más relevante
            best_match = search_results[0]

            # Extraer información detallada del mejor resultado
            video_id = best_match.get('videoId', '')
            match_title = best_match.get('title', title)
            match_artist = best_match.get('artists', [{'name': artist or 'Artista desconocido'}])[0].get('name', artist or 'Artista desconocido')
            match_album = best_match.get('album', {}).get('name', '') if best_match.get('album') else ''

            logger.info(f"[RASTREO-PLAYLIST] MEJOR RESULTADO: videoId='{video_id}', " +
                        f"title='{match_title}', artist='{match_artist}', album='{match_album}'")

            track_info = {
                'id': video_id,
                'title': match_title,
                'artist': match_artist,
                'album': match_album,
                'thumbnail': get_best_thumbnail(best_match.get('thumbnails', [])),
                'duration': best_match.get('duration', '')
            }

            # Guardar en caché solo si tenemos un ID válido
            if track_info['id']:
                try:
                    logger.info(f"[RASTREO-PLAYLIST] Guardando en caché: {query} -> {video_id}")
                    save_to_cache(cache_key, track_info)
                except Exception as save_error:
                    logger.warning(f"[RASTREO-PLAYLIST] Error al guardar en caché: {str(save_error)}")

                logger.info(f"[RASTREO-PLAYLIST] FIN find_track: ÉXITO para '{query}', id='{video_id}'")
                return jsonify(track_info)
            else:
                logger.warning(f"[RASTREO-PLAYLIST] FIN find_track: SIN RESULTADOS para: '{query}'")
                # Devolver resultado vacío pero válido
                fallback_result = {
                    'id': '',
                    'title': title,
                    'artist': artist,
                    'error': 'No se encontraron resultados'
                }
                return jsonify(fallback_result)
        else:
            # No se encontraron resultados
            logger.warning(f"[RASTREO-PLAYLIST] FIN find_track: SIN RESULTADOS para: '{query}'")
            fallback_result = {
                'id': '',
                'title': title,
                'artist': artist,
                'error': 'No se encontraron resultados'
            }
            return jsonify(fallback_result)
    except Exception as e:
        logger.error(
            f"[RASTREO-PLAYLIST] ERROR CRÍTICO en find_track: {str(e)}")
        import traceback
        logger.error(f"[RASTREO-PLAYLIST] Traceback: {traceback.format_exc()}")
        return jsonify({
            'id': '',
            'title': title,
            'artist': artist,
            'error': f"Error al buscar: {str(e)}"
        }), 500


@app.route('/api/spotify-to-youtube', methods=['GET'])
def spotify_to_youtube():
    """Convierte un track de Spotify a YouTube Music"""
    spotify_id = request.args.get('id', '')
    title = request.args.get('title', '')
    artist = request.args.get('artist', '')

    if not spotify_id and (not title or not artist):
        return jsonify(
            {"error": "Se requiere ID de Spotify o título y artista"}), 400

    # Verificar caché
    cache_key = f"spotify_to_youtube_{spotify_id}_{title}_{artist}"
    cached = get_cached(cache_key, ttl_hours=168)  # 1 semana de caché
    if cached:
        return jsonify(cached)

    try:
        # En producción usaríamos ytmusicapi
        # ytmusic = YTMusic(AUTH_FILE) if os.path.exists(AUTH_FILE) else YTMusic()
        # results = ytmusic.search(f"{title} {artist}", filter="songs", limit=5)

        # Simulamos un resultado para desarrollo
        result = {
            'youtube_id': "dQw4w9WgXcQ",
            'spotify_id': spotify_id,
            'title': title or 'Título simulado',
            'artist': artist or 'Artista simulado',
            'duration': 180,  # 3 minutos en segundos
            'thumbnail': "https://via.placeholder.com/150"
        }

        save_to_cache(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    """Obtiene recomendaciones variadas"""
    logger.info("[RASTREO-PLAYLIST] INICIO get_recommendations")

    # Parámetros
    limit = int(request.args.get('limit', 50))
    seed_artist = request.args.get('seed_artist', '')
    seed_track = request.args.get('seed_track', '')

    logger.info(
    f"[RASTREO-PLAYLIST] Parámetros: limit={limit}, seed_artist='{seed_artist}', seed_track='{seed_track}'")

    # Verificar caché
    cache_key = f"recommendations_{seed_artist}_{seed_track}_{limit}"

    # Intentar obtener datos de caché
    try:
        # Menor tiempo para recomendaciones
        cached = get_cached(cache_key, ttl_hours=6)
        if cached:
            logger.info(
    f"[RASTREO-PLAYLIST] CACHÉ: Usando resultados en caché para recomendaciones")
            return jsonify(cached)
    except Exception as cache_error:
        logger.warning(f"[RASTREO-PLAYLIST] ERROR CACHÉ: {str(cache_error)}")

    try:
        logger.info("[RASTREO-PLAYLIST] Obteniendo YTMusic")
        ytm = get_ytmusic()

        results = []

        # Si tenemos una semilla de artista
        if seed_artist:
            try:
                logger.info(
    f"[RASTREO-PLAYLIST] Buscando artista: '{seed_artist}'")
                artist_results = ytm.search(
    seed_artist, filter="artists", limit=1)

                if artist_results and len(artist_results) > 0:
                    artist_id = artist_results[0].get('browseId')
                    logger.info(
    f"[RASTREO-PLAYLIST] ID de artista encontrado: {artist_id}")

                    if artist_id:
                        logger.info(
    f"[RASTREO-PLAYLIST] Obteniendo top tracks del artista: {artist_id}")
                        try:
                            start_time = time.time()
                            artist_songs = ytm.get_artist(artist_id).get(
                                'songs', {}).get('results', [])
                            artist_time = time.time() - start_time

                            logger.info(
                                f"[RASTREO-PLAYLIST] Obtenidos {len(artist_songs)} tracks en {artist_time:.2f}s")

                            for song in artist_songs:
                                if 'videoId' in song:
                                    # Asegurarse de que el artista está
                                    # establecido correctamente
                                    if not song.get(
                                        'artist') and not song.get('artists'):
                                        # Si no hay información de artista,
                                        # usar el artista semilla
                                        song['artist'] = seed_artist

                                    # Usar la función de normalización para
                                    # datos consistentes
                                    track_data = normalize_track_data(
                                        song, default_artist=seed_artist)
                                    if track_data:
                                        # Añadir fuente específica
                                        track_data['source'] = 'artist_track'
                                        results.append(track_data)
                        except Exception as artist_error:
                            logger.error(
                                f"[RASTREO-PLAYLIST] Error obteniendo tracks del artista: {str(artist_error)}")
            except Exception as artist_search_error:
                logger.error(
                    f"[RASTREO-PLAYLIST] Error en búsqueda de artista: {str(artist_search_error)}")

        # Si tenemos una semilla de canción o si no conseguimos resultados por
        # artista
        if seed_track or (seed_artist and len(results) == 0):
            try:
                query = seed_track if seed_track else seed_artist
                logger.info(
    f"[RASTREO-PLAYLIST] Buscando canción similar a: '{query}'")

                search_results = ytm.search(query, filter="songs", limit=1)

                if search_results and len(search_results) > 0:
                    video_id = search_results[0].get('videoId')

                    if video_id:
                        logger.info(
    f"[RASTREO-PLAYLIST] Encontrado video ID: {video_id}, obteniendo recomendaciones")

                        try:
                            start_time = time.time()
                            watch_playlist = ytm.get_watch_playlist(video_id)
                            watch_time = time.time() - start_time

                            tracks = watch_playlist.get('tracks', [])
                            logger.info(
    f"[RASTREO-PLAYLIST] Obtenidas {
        len(tracks)} recomendaciones en {
            watch_time:.2f}s")

                            # Guardar el artista inicial para usarlo como
                            # fallback
                            seed_track_artist = ''
                            if search_results[0].get('artists') and isinstance(
                                search_results[0]['artists'], list):
                                seed_track_artist = search_results[0]['artists'][0].get(
                                    'name', '')
                            elif search_results[0].get('artist'):
                                seed_track_artist = search_results[0]['artist']

                            # Log adicional para debugging
                            logger.info(
    f"[RASTREO-PLAYLIST] Artista de la semilla: '{seed_track_artist}'")

                            # Registra algunos detalles de track para debugging
                            if tracks and len(tracks) > 0:
                                sample_track = tracks[0]
                                logger.info(f"[RASTREO-PLAYLIST] Muestra de estructura de track: " +
                                            f"Keys disponibles: {list(sample_track.keys())}")

                            # Obtener información adicional sobre artistas para
                            # las pistas que no tienen
                            for track in tracks:
                                if track.get(
                                    'videoId') != video_id:  # Excluir la canción original
                                    # Verificar si el track tiene información
                                    # de artista
                                    has_artist_info = (
                                        (track.get('artists') and len(track['artists']) > 0) or
                                        track.get('artist', '').strip() != ''
                                    )

                                    # Si no hay información de artista,
                                    # intentar buscarla
                                    if not has_artist_info:
                                        try:
                                            # Buscar información extra sobre el
                                            # video
                                            logger.info(
    f"[RASTREO-PLAYLIST] Buscando información del artista para el video {
        track.get(
            'videoId', '')}")
                                            # Obtener información de la canción
                                            # desde el título si es necesario
                                            track_title = track.get(
                                                'title', '')

                                            # Si tiene un formato "Artist -
                                            # Title", extraerlo
                                            if " - " in track_title:
                                                parts = track_title.split(
                                                    " - ", 1)
                                                if len(parts) == 2:
                                                    track['artist'] = parts[0].strip()
                                                    logger.info(
                                                        f"[RASTREO-PLAYLIST] Artista extraído del título: '{track['artist']}'")

                                            # Si sigue sin artista, intentar
                                            # buscar la canción
                                            if not track.get(
                                                'artist', '').strip():
                                                try:
                                                    # Hacer una búsqueda rápida
                                                    # por videoId
                                                    song_info = ytm.search(
                                                        track.get('videoId', ''), filter="songs", limit=1)
                                                    if song_info and len(
                                                        song_info) > 0:
                                                        if song_info[0].get('artists') and len(
                                                            song_info[0]['artists']) > 0:
                                                            track['artists'] = song_info[0]['artists']
                                                            logger.info(
    f"[RASTREO-PLAYLIST] Artista encontrado por búsqueda: '{
        song_info[0]['artists'][0].get(
            'name', '')}'")
                                                        elif song_info[0].get('artist'):
                                                            track['artist'] = song_info[0]['artist']
                                                            logger.info(
                                                                f"[RASTREO-PLAYLIST] Artista encontrado por búsqueda: '{song_info[0]['artist']}'")
                                                except Exception as search_error:
                                                    logger.warning(
                                                        f"[RASTREO-PLAYLIST] Error buscando información adicional: {str(search_error)}")
                                        except Exception as info_error:
                                            logger.warning(
                                                f"[RASTREO-PLAYLIST] Error obteniendo información adicional: {str(info_error)}")

                                    # Usar la función de normalización para
                                    # obtener datos consistentes
                                    track_data = normalize_track_data(
                                        track, default_artist='')
                                    if track_data:
                                        results.append(track_data)
                        except Exception as watch_error:
                            logger.error(
                                f"[RASTREO-PLAYLIST] Error obteniendo playlist de watch: {str(watch_error)}")
            except Exception as track_search_error:
                logger.error(
                    f"[RASTREO-PLAYLIST] Error en búsqueda de canción: {str(track_search_error)}")

        # Si aún no tenemos suficientes resultados, añadir recomendaciones
        # generales
        if len(results) < limit:
            logger.info(
                f"[RASTREO-PLAYLIST] No hay suficientes recomendaciones ({len(results)}), añadiendo generales")

            try:
                suggestions = ytm.get_mood_categories()

                if suggestions:
                    logger.info(
                        f"[RASTREO-PLAYLIST] Encontradas {len(suggestions)} categorías de mood")

                    # Tomar solo las primeras 2 categorías
                    for category in suggestions[:2]:
                        if 'params' in category:
                            try:
                                mood_playlists = ytm.get_mood_playlists(
                                    category['params'])

                                if mood_playlists and 'playlists' in mood_playlists:
                                    logger.info(
    f"[RASTREO-PLAYLIST] Categoría '{
        category.get(
            'title', '')}': {
                len(
                    mood_playlists['playlists'])} playlists")

                                    # Tomar la primera playlist de cada
                                    # categoría
                                    if mood_playlists['playlists']:
                                        playlist = mood_playlists['playlists'][0]

                                        if 'browseId' in playlist:
                                            try:
                                                playlist_tracks = ytm.get_playlist(
                                                    playlist['browseId'], limit=10)

                                                if playlist_tracks and 'tracks' in playlist_tracks:
                                                    logger.info(
                                                        f"[RASTREO-PLAYLIST] Playlist '{playlist.get('title', '')}': {len(playlist_tracks['tracks'])} tracks")

                                                    for track in playlist_tracks['tracks']:
                                                        if 'videoId' in track:
                                                            # Para playlists de
                                                            # mood, asegurarnos
                                                            # de que cada track
                                                            # tiene artista
                                                            has_artist_info = (
                                                                (track.get('artists') and len(track['artists']) > 0) or
                                                                track.get(
                                                                    'artist', '').strip() != ''
                                                            )

                                                            # Si no hay
                                                            # información de
                                                            # artista, intentar
                                                            # extraerla del
                                                            # título
                                                            if not has_artist_info:
                                                                track_title = track.get(
                                                                    'title', '')
                                                                if " - " in track_title:
                                                                    parts = track_title.split(
                                                                        " - ", 1)
                                                                    if len(
                                                                        parts) == 2:
                                                                        track['artist'] = parts[0].strip(
                                                                        )
                                                                        logger.info(
                                                                            f"[RASTREO-PLAYLIST] Artista extraído de título: '{track['artist']}'")

                                                            # Usar la función
                                                            # de normalización
                                                            # para datos
                                                            # consistentes
                                                            track_data = normalize_track_data(
                                                                track, default_artist='')
                                                            if track_data:
                                                                # Añadir fuente
                                                                # específica
                                                                track_data['source'] = 'mood_recommendation'
                                                                results.append(
                                                                    track_data)
                                            except Exception as playlist_error:
                                                logger.error(
                                                    f"[RASTREO-PLAYLIST] Error obteniendo playlist: {str(playlist_error)}")
                            except Exception as mood_error:
                                logger.error(
                                    f"[RASTREO-PLAYLIST] Error obteniendo mood playlists: {str(mood_error)}")
            except Exception as mood_error:
                logger.error(
                    f"[RASTREO-PLAYLIST] Error obteniendo categorías de mood: {str(mood_error)}")

        # Eliminar duplicados basados en ID
        unique_results = {}
        for track in results:
            if track.get('id') and track['id'] not in unique_results:
                unique_results[track['id']] = track

        # Convertir diccionario de nuevo a lista
        results = list(unique_results.values())
        logger.info(
            f"[RASTREO-PLAYLIST] {len(results)} tracks únicos después de eliminar duplicados")

        # Limitar a la cantidad solicitada
        final_results = []
        for track in results[:limit]:
            # Verificar que los datos del track son válidos
            if track.get('id') and track.get('title'):
                # Para canciones sin artista, intentar un enfoque final
                if not track.get('artist') or track.get(
                    'artist') == 'Artista desconocido':
                    # Último intento: extraer artista del título si tiene
                    # formato "Artista - Título"
                    title = track.get('title', '')
                    if " - " in title:
                        parts = title.split(" - ", 1)
                        if len(parts) == 2:
                            track['artist'] = parts[0].strip()
                            logger.info(
                                f"[RASTREO-PLAYLIST] Artista extraído de último intento: '{track['artist']}'")

                # Añadir información extra de diagnóstico si es necesario
                logger.debug(f"[RASTREO-PLAYLIST] Track validado: id={track['id']}, "
                             f"title='{track['title']}', artist='{track.get('artist', 'Desconocido')}'")
                final_results.append(track)
            else:
                logger.warning(
    f"[RASTREO-PLAYLIST] Omitiendo track con datos incompletos: {track}")

        # Log de resultados
        logger.info(
            f"[RASTREO-PLAYLIST] Total de recomendaciones validadas: {len(final_results)}")

        # Verificar diversidad de artistas
        artist_counts = {}
        for track in final_results:
            artist = track.get('artist', 'Desconocido')
            artist_counts[artist] = artist_counts.get(artist, 0) + 1

        unique_artists = list(artist_counts.keys())
        logger.info(
    f"[RASTREO-PLAYLIST] Artistas únicos: {
        len(unique_artists)}, distribución: {artist_counts}")

        # Guardar en caché
        try:
            logger.info(
                f"[RASTREO-PLAYLIST] Guardando {len(final_results)} recomendaciones en caché")
            save_to_cache(cache_key, final_results)
        except Exception as save_error:
            logger.warning(
                f"[RASTREO-PLAYLIST] Error guardando en caché: {str(save_error)}")

        logger.info("[RASTREO-PLAYLIST] FIN get_recommendations: ÉXITO")
        return jsonify(final_results)
    except Exception as e:
        logger.error(
            f"[RASTREO-PLAYLIST] ERROR CRÍTICO en get_recommendations: {str(e)}")
        import traceback
        logger.error(f"[RASTREO-PLAYLIST] Traceback: {traceback.format_exc()}")

        # En caso de error, devolver un array vacío con código 200 para que el
        # frontend no falle
        return jsonify([]), 200


@app.route('/api/top-artists', methods=['GET'])
def get_top_artists():
    """Obtiene artistas populares de YouTube Music"""
    limit = int(request.args.get('limit', 16))

    # Verificar caché
    cache_key = f"top_artists_{limit}"
    cached = get_cached(cache_key, ttl_hours=24)  # Caché por 24 horas
    if cached:
        return jsonify(cached)

    try:
        ytm = get_ytmusic()

        # Obtener diferentes géneros para diversificar resultados
        genres = ["pop", "rock", "hip hop", "electrónica", "latin"]
        all_artists = []

        # Buscar artistas por género
        for genre in genres[:3]:  # Limitamos a 3 géneros para no hacer muchas llamadas
            search_results = ytm.search(f"{genre} artist", filter="artists", limit=limit // 3)
            logger.info(
                f"Búsqueda de artistas para género {genre}, resultados: {
        len(search_results)}")
            all_artists.extend(search_results)

        # Formatear resultados en un formato similar al que espera nuestra
        # aplicación
        formatted_artists = []
        for artist in all_artists[:limit]:
            # Asegurarse de que tenemos todos los campos necesarios
            if 'browseId' in artist and 'thumbnails' in artist:
                artist_data = {
                    'id': artist['browseId'],
                    'name': artist.get('artist', 'Artista Desconocido'),
                    'images': [{'url': artist['thumbnails'][-1]['url']}] if artist['thumbnails'] else [],
                    'genres': [artist.get('category', 'música')],
                    'popularity': 80  # No disponible en YTMusic, asignamos un valor por defecto
                }
                formatted_artists.append(artist_data)

        logger.info(
            f"Artistas populares encontrados: {
        len(formatted_artists)}")

        # Si no encontramos artistas, crear algunos de ejemplo
        if not formatted_artists:
            for i in range(min(16, limit)):
                formatted_artists.append({
                    'id': f"artist{i}",
                    'name': f"Artista Popular {i}",
                    'images': [{'url': f"https://via.placeholder.com/300?text=Artist{i}"}],
                    'genres': [genres[i % len(genres)]],
                    'popularity': 80 + (i % 20)
                })

        result = {'items': formatted_artists[:limit]}
        save_to_cache(cache_key, result)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error al obtener artistas populares: {str(e)}")
        # Devolver datos simulados en caso de error
        result = {'items': [{ 'id': "artist_fallback_1",
                               'name': "Artista Pop",
                               'images': [{'url': "https://via.placeholder.com/300?text=PopArtist"}],
                'genres': ["pop"],
            'popularity': 90 },
    {'id': "artist_fallback_2",
      'name': "Artista Rock",
                'images': [{'url': "https://via.placeholder.com/300?text=RockArtist"}],
                'genres': ["rock"],
      'popularity': 85 } ]}
        return jsonify(result)


@app.route('/api/recommendations-by-genres', methods=['GET'])
def get_recommendations_by_genres():
    """Obtiene recomendaciones basadas en los géneros favoritos del usuario"""
    # Parámetros
    genres = request.args.getlist('genres[]') or []
    artists_per_genre = int(request.args.get('artistsPerGenre', 20))
    playlists_per_genre = int(request.args.get('playlistsPerGenre', 10))
    tracks_per_genre = int(request.args.get('tracksPerGenre', 30))

    # Verificar que se hayan proporcionado géneros
    if not genres:
        return jsonify({"error": "Se requieren géneros favoritos"}), 400

    # Limitar a los 3 principales géneros
    top_genres = genres[:3]
    logger.info(f"Obteniendo recomendaciones para géneros: {top_genres}")

    # Verificar caché
    cache_key = f"recommendations_by_genres_{
        '-'.join(top_genres)}_{artists_per_genre}_{playlists_per_genre}_{tracks_per_genre}"
    cached = get_cached(cache_key, ttl_hours=4)  # 4 horas de caché
    if cached:
        logger.info(
            f"Usando caché para recomendaciones de géneros: {top_genres}")
        return jsonify(cached)

    try:
        ytm = get_ytmusic()
        result = {
            "artists": [],
            "playlists": [],
            "tracks": []
        }

        # Obtener artistas, playlists y tracks para cada género
        for genre in top_genres:
            logger.info(f"Procesando género: {genre}")

            # 1. Artistas
            logger.info(f"Buscando artistas para género: {genre}")
            artists_results = ytm.search(
                f"{genre} artist",
                filter="artists",
                limit=artists_per_genre)
            if artists_results:
                # Formatear y agregar artistas al resultado
                for artist in artists_results:
                    if 'browseId' in artist and 'thumbnails' in artist:
                        artist_data = {
                            'id': artist['browseId'],
                            'name': artist.get('artist', 'Artista Desconocido'),
                            'images': [{'url': artist['thumbnails'][-1]['url']}] if artist['thumbnails'] else [],
                            # Asignamos el género de búsqueda
                            'genres': [genre],
                            'popularity': 80,  # No disponible en YTMusic
                            'source': 'youtube_music',
                            'sourceGenre': genre
                        }
                        result['artists'].append(artist_data)

            # 2. Playlists
            logger.info(f"Buscando playlists para género: {genre}")
            playlists_results = ytm.search(
                f"{genre} music",
                filter="playlists",
                limit=playlists_per_genre)
            if playlists_results:
                # Formatear y agregar playlists al resultado
                for playlist in playlists_results:
                    if 'browseId' in playlist:
                        playlist_data = {
                            'id': playlist['browseId'],
                            'name': playlist.get('title', 'Playlist Sin Título'),
                            'description': playlist.get('description', ''),
                            'images': [{'url': playlist['thumbnails'][-1]['url']}] if 'thumbnails' in playlist and playlist['thumbnails'] else [],
                            'tracks_count': playlist.get('itemCount', 0),
                            'owner': playlist.get('author', {}).get('name', 'YouTube Music'),
                            'source': 'youtube_music',
                            'sourceGenre': genre
                        }
                        result['playlists'].append(playlist_data)

            # 3. Tracks
            logger.info(f"Buscando tracks para género: {genre}")
            tracks_results = ytm.search(
                f"{genre}", filter="songs", limit=tracks_per_genre)
            if tracks_results:
                # Formatear y agregar tracks al resultado
                for track in tracks_results:
                    if 'videoId' in track:
                        track_data = {
                            'id': track['videoId'],
                            'title': track.get('title', 'Canción sin título'),
                            'artist': track.get('artists', [{}])[0].get('name', 'Artista desconocido') if 'artists' in track and track['artists'] else 'Artista desconocido',
                            'album': track.get('album', {}).get('name', 'Álbum desconocido') if 'album' in track else 'Álbum desconocido',
                            'cover': track['thumbnails'][-1]['url'] if 'thumbnails' in track and track['thumbnails'] else '',
                            'duration': track.get('duration_seconds', 0) * 1000 if 'duration_seconds' in track else 0,
                            'source': 'youtube',
                            'youtubeId': track['videoId'],
                            'sourceGenre': genre
                        }
                        result['tracks'].append(track_data)

        # Guardar en caché
        save_to_cache(cache_key, result)
        logger.info(
            f"Recomendaciones generadas: {
        len(
            result['artists'])} artistas, {
                len(
                    result['playlists'])} playlists, {
                        len(
                            result['tracks'])} tracks")

        return jsonify(result)
    except Exception as e:
        logger.error(f"Error al obtener recomendaciones por géneros: {str(e)}")
        # Generar datos de fallback en caso de error
        fallback_result = {
            "artists": [],
            "playlists": [],
            "tracks": []
        }

        # Generar algunos datos de ejemplo para cada género
        for genre in top_genres:
            # Artistas fallback
            for i in range(5):
                fallback_result['artists'].append({
                    'id': f"fallback_artist_{genre}_{i}",
                    'name': f"Artista de {genre.capitalize()} {i + 1}",
                    'images': [{'url': f"https://via.placeholder.com/300?text={genre}+Artist+{i + 1}"}],
                    'genres': [genre],
                    'popularity': 80,
                    'source': 'youtube_music',
                    'sourceGenre': genre
                })

            # Playlists fallback
            for i in range(3):
                fallback_result['playlists'].append({
                    'id': f"fallback_playlist_{genre}_{i}",
                    'name': f"Playlist de {genre.capitalize()} {i + 1}",
                    'description': f"Los mejores éxitos de {genre}",
                    'images': [{'url': f"https://via.placeholder.com/300?text={genre}+Playlist+{i + 1}"}],
                    'tracks_count': 20,
                    'owner': 'YouTube Music',
                    'source': 'youtube_music',
                    'sourceGenre': genre
                })

            # Tracks fallback
            for i in range(10):
                fallback_result['tracks'].append({
                    'id': f"fallback_track_{genre}_{i}",
                    'title': f"Canción de {genre.capitalize()} {i + 1}",
                    'artist': f"Artista de {genre.capitalize()}",
                    'album': f"Álbum de {genre.capitalize()}",
                    'cover': f"https://via.placeholder.com/300?text={genre}+Track+{i + 1}",
                    'duration': 180000,  # 3 minutos
                    'source': 'youtube',
                    'youtubeId': f"fallback_track_{genre}_{i}",
                    'sourceGenre': genre
                })

        return jsonify(fallback_result)


@app.route('/featured-playlists', methods=['GET'])
@cached('featured_playlists.json')
def get_featured_playlists():
    """Endpoint para obtener playlists destacadas"""
    try:
        limit = int(request.args.get('limit', 10))
        region = request.args.get('region', 'US')  # Nuevo parámetro de región

        logger.info(
            f"Obteniendo playlists destacadas para región {region}, límite {limit}")

        # Intentar obtener la sección de exploración
        try:
            # Usar YTMusic directamente sin get_ytmusic
            # Configurar YTMusic con la región del usuario
            ytmusic = YTMusic(language=region)
            explore_data = ytmusic.get_explore()

            # Verificar si la respuesta es válida y contiene playlists
            if explore_data and 'sections' in explore_data:
                # Buscar la sección de playlists destacadas (generalmente la
                # segunda sección)
                playlists_section = None
                for section in explore_data['sections']:
                    if 'Playlists' in section.get('title', ''):
                        playlists_section = section
                        break

                # Si encontramos la sección de playlists
                if playlists_section and 'playlists' in playlists_section:
                    playlists = playlists_section['playlists'][:limit]

                    # Asegurar que todas las playlists tienen thumbnails
                    # válidos
                    valid_playlists = []
                    for playlist in playlists:
                        if 'thumbnails' in playlist and playlist['thumbnails']:
                            # Agregar región a la información de la playlist
                            playlist['region'] = region
                            valid_playlists.append(playlist)

                    logger.info(
                        f"Encontradas {
        len(valid_playlists)} playlists destacadas para región {region}")
                    return jsonify(valid_playlists)
        except Exception as e:
            logger.error(
                f"Error al obtener playlists destacadas desde la exploración: {
        str(e)}")

        # Si no hay datos de explore o hubo un error, usar playlists
        # predefinidas según la región
        logger.info(
            f"Usando playlists predefinidas como fallback para región {region}")

        # Playlists específicas por región
        region_playlists = {'ES': [ { "title": "Éxitos España",
                                       "playlistId": "ES_top_hits",
                                       "author": "YouTube Music",
                                       "description": "Los éxitos más populares en España",
                                       "trackCount": 50,
                                       "thumbnails": [{"url": "https://i.ytimg.com/vi/p7bfOZek9t4/maxresdefault.jpg"}],
            "region": "ES" },
    {"title": "Flamenco Fusion",
      "playlistId": "ES_flamenco",
                    "author": "YouTube Music",
                    "description": "Lo mejor del flamenco fusión",
                    "trackCount": 30,
                    "thumbnails": [{"url": "https://i.ytimg.com/vi/qmbx4_TQbkA/maxresdefault.jpg"}],
      "region": "ES" } ],
    'MX': [{ "title": "Regional Mexicano",
              "playlistId": "MX_regional",
                    "author": "YouTube Music",
                    "description": "Lo mejor de la música regional mexicana",
                    "trackCount": 40,
                    "thumbnails": [{"url": "https://i.ytimg.com/vi/NGZ-xIDBiCs/maxresdefault.jpg"}],
              "region": "MX" },
    {"title": "Pop Latino México",
      "playlistId": "MX_pop",
                    "author": "YouTube Music",
                    "description": "El pop más escuchado en México",
                    "trackCount": 45,
                    "thumbnails": [{"url": "https://i.ytimg.com/vi/MBmb5_TTT-w/maxresdefault.jpg"}],
      "region": "MX" } ],
    'AR': [{ "title": "Trap Argentino",
              "playlistId": "AR_trap",
                    "author": "YouTube Music",
                    "description": "El mejor trap de Argentina",
                    "trackCount": 40,
                    "thumbnails": [{"url": "https://i.ytimg.com/vi/3V-bu_i-w_o/maxresdefault.jpg"}],
              "region": "AR" } ] }

        # Playlists genéricas para todas las regiones
        generic_playlists = [{ "title": "Top Hits Globales",
                                "playlistId": "PL55713C70BA91BD6E",
                                "author": "YouTube Music",
                                "description": "Los éxitos más populares del momento",
                                "trackCount": 50,
                                "thumbnails": [{"url": "https://i.ytimg.com/vi/kJQP7kiw5Fk/maxresdefault.jpg"}],
            "region": "global" },
    {"title": "Éxitos Latinos",
      "playlistId": "PL4fGSI1pDJn6jXS_Tv_N9B8Z0HTRVJE0n",
                "author": "YouTube Music",
                "description": "Lo mejor de la música latina",
                "trackCount": 40,
                "thumbnails": [{"url": "https://i.ytimg.com/vi/TmKh7lAwnBI/maxresdefault.jpg"}],
      "region": "global" },
    {"title": "Acoustic Chill",
      "playlistId": "PLgzTt0k8mXzEk586ze4BjvDXR7c-TUSnx",
                "author": "YouTube Music",
                "description": "Música acústica para relajarte",
                "trackCount": 35,
                "thumbnails": [{"url": "https://i.ytimg.com/vi/jTLhQf5KJSc/maxresdefault.jpg"}],
      "region": "global" },
    {"title": "Workout Hits",
      "playlistId": "PL4o29bINVT4EG_y-k5jGoOu3-Am8Nvi10",
                "author": "YouTube Music",
                "description": "Música para entrenar",
                "trackCount": 45,
                "thumbnails": [{"url": "https://i.ytimg.com/vi/pRpeEdMmmQ0/maxresdefault.jpg"}],
      "region": "global" },
    {"title": "Indie Discoveries",
      "playlistId": "PL4fGSI1pDJn5kI81J1fYWK5eZRl1zJ5kM",
                "author": "YouTube Music",
                "description": "Descubre nuevas bandas indie",
                "trackCount": 30,
                "thumbnails": [{"url": "https://i.ytimg.com/vi/8SbUC-UaAxE/maxresdefault.jpg"}],
      "region": "global" } ]

        # Combinar playlists específicas de la región con las genéricas
        combined_playlists = region_playlists.get(
            region, []) + generic_playlists

        # Limitar al número solicitado
        combined_playlists = combined_playlists[:limit]

        return jsonify(combined_playlists)
    except Exception as e:
        logger.error(f"Error en get_featured_playlists: {str(e)}")
        return jsonify([])


@app.route('/new-releases', methods=['GET'])
@cached('new_releases.json')
def get_new_releases():
    """Endpoint para obtener nuevos lanzamientos"""
    try:
        limit = int(request.args.get('limit', 10))
        # Parámetro de región, por defecto US
        region = request.args.get('region', 'US')

        logger.info(
            f"Obteniendo nuevos lanzamientos para región {region}, límite {limit}")

        # Intentar obtener la sección de exploración
        try:
            # Usar YTMusic directamente sin get_ytmusic
            # Configurar YTMusic con el idioma/región del usuario
            ytmusic = YTMusic(language=region)

            # Obtener nuevos lanzamientos a través de la API de charts
            # Ya que los charts suelen tener contenido más actualizado
            charts = ytmusic.get_charts(country=region)

            # También obtener la sección de exploración para tener más fuentes
            explore_data = ytmusic.get_explore()

            # Lista para almacenar los lanzamientos combinados
            all_releases = []

            # 1. Primero intentar con la sección de nuevos lanzamientos de
            # explore
            if explore_data and 'sections' in explore_data:
                # Buscar la sección de nuevos lanzamientos (generalmente la
                # primera sección)
                for section in explore_data['sections']:
                    if ('New' in section.get('title', '') or
                        'Nuevo' in section.get('title', '') or
                            'reciente' in section.get('title', '').lower()):
                        if 'items' in section:
                            all_releases.extend(section['items'])
                            logger.info(
                                f"Encontrados {
        len(
            section['items'])} nuevos lanzamientos en sección '{
                section.get(
                    'title',
                    '')}'")

            # 2. Agregar lanzamientos de charts (tendencias)
            if charts and 'singles' in charts:
                # Los singles en charts suelen ser más recientes
                singles = charts['singles'][:limit]
                logger.info(f"Encontrados {len(singles)} singles en charts")
                all_releases.extend(singles)

            # 3. También intentar con los álbumes nuevos de charts
            if charts and 'albums' in charts:
                # Filtrar solo los álbumes que parecen más recientes basados en
                # metadatos
                recent_albums = []
                for album in charts['albums'][:limit * 2]:  # Obtenemos más para luego filtrar
                    # En la práctica real necesitaríamos verificar la fecha de lanzamiento
                    # pero YTMusic API no proporciona esta información fácilmente
                    # Así que usamos claves en los títulos que sugieren novedad
                    if album and 'title' in album:
                        title = album['title'].lower()
                        if ('new' in title or 'nuevo' in title or
                                '2025' in title or '2024' in title):
                            recent_albums.append(album)

                logger.info(
                    f"Encontrados {
        len(recent_albums)} álbumes recientes en charts")
                all_releases.extend(recent_albums)

            # Eliminar duplicados basados en videoId o browseId
            unique_releases = {}
            for release in all_releases:
                if not release:
                    continue

                # Usar videoId o browseId como clave única
                release_id = release.get(
                    'videoId', release.get(
        'browseId', ''))
                if release_id and release_id not in unique_releases:
                    unique_releases[release_id] = release

            # Convertir a lista
            filtered_releases = list(unique_releases.values())
            logger.info(
                f"Total de {
        len(filtered_releases)} lanzamientos únicos encontrados")

            # Limitar al número solicitado
            filtered_releases = filtered_releases[:limit]

            # Transformar el formato para hacerlo compatible con el frontend
            formatted_releases = []
            for release in filtered_releases:
                if 'thumbnails' in release and release['thumbnails']:
                    formatted_release = {
                        'id': release.get('videoId', release.get('browseId', f"yt-{release.get('title', '').replace(' ', '-')}")),
                        'name': release.get('title', 'Sin título'),
                        'artists': [{'name': release.get('subtitle', release.get('artist', 'Artista desconocido'))}],
                        'images': [{'url': thumb.get('url', '')} for thumb in release.get('thumbnails', [])],
                        'release_date': '2025',  # YouTube Music no proporciona fecha exacta en esta API
                        'type': release.get('type', 'album'),
                        'region': region
                    }
                    formatted_releases.append(formatted_release)

            if formatted_releases:
                logger.info(
                    f"Devolviendo {
        len(formatted_releases)} nuevos lanzamientos para región {region}")
                return jsonify(formatted_releases)
        except Exception as e:
            logger.error(
                f"Error al obtener nuevos lanzamientos desde la exploración: {
        str(e)}")

        # Si no hay datos de explore o hubo un error, usar álbumes predefinidos
        logger.info(
            f"Usando álbumes predefinidos como fallback para región {region}")

        # Personalizar algunos álbumes predefinidos basados en la región
        region_specific_albums = {'ES': [ { 'id': 'yt-album-es-1',
                                             'name': 'El Madrileño',
                                             'artists': [{'name': 'C. Tangana'}],
                    'images': [{'url': 'https://i.ytimg.com/vi/7Z2XmgX-jjE/maxresdefault.jpg'}],
                    'release_date': '2025',
                    'type': 'album',
            'region': 'ES' },
    {'id': 'yt-album-es-2',
      'name': 'Vibras',
                    'artists': [{'name': 'J Balvin'}],
                    'images': [{'url': 'https://i.ytimg.com/vi/0MpFSsP9rIM/maxresdefault.jpg'}],
                    'release_date': '2025',
                    'type': 'album',
      'region': 'ES' } ],
    'MX': [{ 'id': 'yt-album-mx-1',
                    'name': 'Un Canto por México',
                    'artists': [{'name': 'Natalia Lafourcade'}],
                    'images': [{'url': 'https://i.ytimg.com/vi/F0IjuWLTuZM/maxresdefault.jpg'}],
                    'release_date': '2025',
                    'type': 'album',
              'region': 'MX' },
    {'id': 'yt-album-mx-2',
      'name': 'Mañana Será Bonito',
                    'artists': [{'name': 'Karol G'}],
                    'images': [{'url': 'https://i.ytimg.com/vi/sqj6yUQyGmw/maxresdefault.jpg'}],
                    'release_date': '2025',
                    'type': 'album',
      'region': 'MX' } ],
    'AR': [{ 'id': 'yt-album-ar-1',
                    'name': 'Bzrp Music Sessions',
                    'artists': [{'name': 'Bizarrap'}],
                    'images': [{'url': 'https://i.ytimg.com/vi/3nQNiWdeH2Q/maxresdefault.jpg'}],
                    'release_date': '2025',
                    'type': 'album',
              'region': 'AR' } ] }

        # Álbumes predefinidos generales
        default_albums = [{ 'id': 'yt-album-1',
                             'name': 'Future Nostalgia (2025 Edition)',
                             'artists': [{'name': 'Dua Lipa'}],
                'images': [{'url': 'https://i.ytimg.com/vi/WHuBW3qKm9g/maxresdefault.jpg'}],
                'release_date': '2025',
                'type': 'album',
            'region': 'global' },
    {'id': 'yt-album-2',
      'name': 'Un Verano Sin Ti (Deluxe)',
                'artists': [{'name': 'Bad Bunny'}],
                'images': [{'url': 'https://i.ytimg.com/vi/1TCX_Aqzoo4/maxresdefault.jpg'}],
                'release_date': '2025',
                'type': 'album',
      'region': 'global' },
    {'id': 'yt-album-3',
      'name': 'After Hours (Extended Version)',
                'artists': [{'name': 'The Weeknd'}],
                'images': [{'url': 'https://i.ytimg.com/vi/XXYlFuWEuKI/maxresdefault.jpg'}],
                'release_date': '2025',
                'type': 'album',
      'region': 'global' },
    {'id': 'yt-album-4',
      'name': 'Harry\'s House (Expanded Edition)',
                'artists': [{'name': 'Harry Styles'}],
                'images': [{'url': 'https://i.ytimg.com/vi/H5v3kku4y6Q/maxresdefault.jpg'}],
                'release_date': '2025',
                'type': 'album',
      'region': 'global' },
    {'id': 'yt-album-5',
      'name': 'Midnights (The Complete Collection)',
                'artists': [{'name': 'Taylor Swift'}],
                'images': [{'url': 'https://i.ytimg.com/vi/b1kbLwvqugk/maxresdefault.jpg'}],
                'release_date': '2025',
                'type': 'album',
      'region': 'global' } ]

        # Combinar álbumes específicos de región con los predeterminados
        fallback_albums = region_specific_albums.get(
            region, []) + default_albums

        # Asegurarnos de que no excedemos el límite
        fallback_albums = fallback_albums[:limit]

        return jsonify(fallback_albums)
    except Exception as e:
        logger.error(f"Error en get_new_releases: {str(e)}")
        return jsonify([])


@app.route('/charts', methods=['GET'])
@cached('charts.json')
def get_charts():
    """Endpoint para obtener charts/tendencias musicales"""
    try:
        limit = int(request.args.get('limit', 20))
        # Parámetro de región, por defecto US
        region = request.args.get('region', 'US')

        logger.info(
            f"Obteniendo charts para región {region}, límite {limit}")

        # Intentar obtener charts directamente
        try:
            # Configurar YTMusic con el idioma/región del usuario
            ytmusic = YTMusic(language=region)

            # Obtener charts para la región especificada
            charts = ytmusic.get_charts(country=region)

            # Verificar si tenemos singles en los charts
            if charts and 'singles' in charts and charts['singles']:
                singles = charts['singles'][:limit]
                logger.info(f"Encontrados {len(singles)} singles en charts para región {region}")
                
                # Agregar información de región a cada elemento
                for single in singles:
                    single['region'] = region
                    
                    # Asegurarse de que el tipo sea 'track'
                    single['type'] = 'track'
                    
                    # Normalizar la estructura para que sea similar a la de Spotify
                    if 'artists' not in single and 'artist' in single:
                        single['artists'] = [{'name': single['artist']}]
                
                return jsonify({"singles": singles})
            else:
                logger.warning(f"No se encontraron singles en charts para región {region}")
        except Exception as chart_error:
            logger.error(f"Error obteniendo charts de YouTube Music: {str(chart_error)}")
            
        # Si llegamos aquí, ocurrió un error o no hay datos - Devolver datos por defecto
        # Datos de fallback específicos por región
        region_specific_tracks = {
            'US': [
                {
                    'videoId': 'us_pop_1',
                    'title': 'US Pop Hit 1',
                    'artists': [{'name': 'US Artist 1'}],
                    'thumbnails': [{'url': 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'}],
                    'type': 'track',
                    'region': 'US'
                }
            ],
            'ES': [
                {
                    'videoId': 'es_pop_1',
                    'title': 'Hit Latino 1',
                    'artists': [{'name': 'Artista Latino 1'}],
                    'thumbnails': [{'url': 'https://i.ytimg.com/vi/kJQP7kiw5Fk/maxresdefault.jpg'}],
                    'type': 'track',
                    'region': 'ES'
                }
            ]
        }
        
        # Tracks por defecto para todas las regiones
        default_tracks = [
            {
                'videoId': 'global_pop_1',
                'title': 'Global Hit 1',
                'artists': [{'name': 'Global Artist 1'}],
                'thumbnails': [{'url': 'https://i.ytimg.com/vi/JGwWNGJdvx8/maxresdefault.jpg'}],
                'type': 'track',
                'region': 'global'
            },
            {
                'videoId': 'global_pop_2',
                'title': 'Global Hit 2',
                'artists': [{'name': 'Global Artist 2'}],
                'thumbnails': [{'url': 'https://i.ytimg.com/vi/3tmd-ClpJxA/maxresdefault.jpg'}],
                'type': 'track',
                'region': 'global'
            }
        ]
        
        # Combinar tracks específicos de región con los predeterminados
        fallback_tracks = region_specific_tracks.get(region, []) + default_tracks
        
        # Asegurarnos de que no excedemos el límite
        fallback_tracks = fallback_tracks[:limit]
        
        return jsonify({"singles": fallback_tracks})
    except Exception as e:
        logger.error(f"Error en get_charts: {str(e)}")
        return jsonify({"singles": []})


@app.route('/artists-by-genre', methods=['GET'])
def get_artists_by_genre():
    """Endpoint para obtener artistas por género"""
    genre = request.args.get('genre', 'pop')
    limit = int(request.args.get('limit', 10))
    region = request.args.get('region', 'US')  # Nuevo parámetro de región
    language = request.args.get('language', 'en')  # Añadir parámetro de idioma
    # Parámetro para forzar bypass del caché
    no_cache = request.args.get('_t', None)

    logger.info(
        f"[DEBUG] NUEVA SOLICITUD de artistas por género: género={genre}, límite={limit}, región={region}, idioma={language}")

    if not genre:
        logger.warning("[DEBUG] No se proporcionó ningún género")
        return jsonify([])

    # Lista de idiomas soportados por YouTube Music
    supported_languages = [
        'ja',
        'en',
        'de',
        'zh_CN',
        'fr',
        'ur',
        'ko',
        'hi',
        'ru',
        'nl',
        'es',
        'ar',
        'pt',
        'zh_TW',
        'tr',
        'it']

    # Verificar si el idioma es soportado
    if language not in supported_languages:
        logger.warning(
            f"Idioma '{language}' no soportado. Usando inglés como fallback.")
        language = 'en'  # Usar inglés como fallback si el idioma no es soportado

    # Verificar caché solo si no se ha especificado no_cache
    use_cache = no_cache is None

    if use_cache:
        # Verificar caché con la clave correcta que incluye idioma
        cache_key = f"artists_by_genre_{genre}_{limit}_{region}_{language}"
        cached_results = get_cached_results(cache_key)
        if cached_results:
            logger.info(
                f"Usando caché para artists_by_genre con género {genre}, región {region}, idioma {language}")
            return jsonify(cached_results)
    else:
        logger.info(f"Omitiendo caché por solicitud explícita")

    try:
        logger.info(
            f"[DEBUG] BUSCANDO ACTIVAMENTE artistas para género: {genre}, idioma: {language}")

        # Lista para almacenar artistas
        artists = []

        # Intentar buscar artistas con la API, pero envolver en try/except
        try:
            # Crear una instancia YTMusic con el idioma correcto
            music = YTMusic(language=language)
            logger.info(
                f"[DEBUG] Instancia YTMusic creada con idioma {language}")

            # Evitar formar consultas inválidas como "genre:Lucky Jason Mraz"
            # En su lugar, buscar directamente con el género como término de
            # búsqueda
            start_time = time.time()
            logger.info(
                f"[DEBUG] Iniciando búsqueda con parámetros: género={genre}, idioma={language}")

            search_results = music.search(genre, filter='artists', limit=limit)
            elapsed_time = time.time() - start_time

            logger.info(
                f"Búsqueda completada en {
        elapsed_time:.2f}s. Resultados: {
            len(search_results) if search_results else 0}")

            # Procesar resultados
            if search_results and len(search_results) > 0:
                logger.info(
                    f"[DEBUG] Procesando {
        len(search_results)} resultados de artistas reales para género {genre}")
                for artist_data in search_results:
                    if not artist_data:
                        continue

                    thumbnails = artist_data.get('thumbnails', [])
                    if not thumbnails:
                        thumbnails = [{'url': ''}]

                    artist = {
                        'id': artist_data.get('browseId', f'yt-artist-{len(artists)}'),
                        'name': artist_data.get('artist', artist_data.get('name', 'Artista desconocido')),
                        'images': [{'url': image.get('url', '')} for image in thumbnails],
                        'genres': [genre],  # Asignar el género buscado
                        'popularity': 50,  # Valor predeterminado
                        'source': 'youtube',
                        'region': region,
                        'fromSearch': True  # Marcar como resultado real de búsqueda
                    }
                    artists.append(artist)

                logger.info(
                    f"[DEBUG] Búsqueda exitosa para género {genre}. {
        len(artists)} artistas encontrados")
            else:
                logger.warning(
                    f"[DEBUG] No se encontraron artistas para el género '{genre}'")
                artists = []

        except Exception as search_error:
            # Si hay un error en la búsqueda, registrarlo pero continuar usando
            # artistas predefinidos
            logger.error(
                f"Error al buscar artistas para género '{genre}': {
        str(search_error)}")

            # Verificar si el error es por idioma no soportado e intentar con
            # inglés
            if "Language not supported" in str(
                    search_error) and language != 'en':
                logger.warning(
                    f"Idioma '{language}' no soportado para esta región. Intentando con inglés...")
                try:
                    # Intentar de nuevo con inglés
                    music = YTMusic(language='en')
                    logger.info(
                        f"[DEBUG] Reintentando búsqueda con idioma 'en'")
                    search_results = music.search(
                        genre, filter='artists', limit=limit)

                    if search_results and len(search_results) > 0:
                        logger.info(
                            f"[DEBUG] Búsqueda con inglés exitosa. Procesando {
        len(search_results)} resultados")
                        for artist_data in search_results:
                            if not artist_data:
                                continue

                            thumbnails = artist_data.get('thumbnails', [])
                            if not thumbnails:
                                thumbnails = [{'url': ''}]

                            artist = {
                                'id': artist_data.get('browseId', f'yt-artist-{len(artists)}'),
                                'name': artist_data.get('artist', artist_data.get('name', 'Artista desconocido')),
                                'images': [{'url': image.get('url', '')} for image in thumbnails],
                                'genres': [genre],
                                'popularity': 50,
                                'source': 'youtube',
                                'region': region,
                                'fromSearch': True
                            }
                            artists.append(artist)
                    else:
                        logger.warning(
                            f"[DEBUG] Segundo intento con inglés no encontró artistas para '{genre}'")
                except Exception as retry_error:
                    logger.error(
                        f"Error al reintentar búsqueda con idioma 'en': {
        str(retry_error)}")

            if len(artists) == 0:
                logger.info(
                    "Usando artistas predefinidos debido a error en búsqueda")
                artists = []  # Asegurar que la lista está vacía para usar predefinidos

        # Si no hay suficientes artistas (ya sea porque falló la búsqueda o no devolvió suficientes),
        # añadir predefinidos según el género y región
        if len(artists) < limit:
            logger.info(
                f"No hay suficientes artistas ({
        len(artists)}). Usando artistas predefinidos para género '{genre}' en región '{region}'")
            genre_specific_artists = get_predefined_artists_by_genre(
                genre, limit, region)

            # Si ya tenemos algunos artistas, combinarlos con los predefinidos
            if len(artists) > 0:
                # Combinar los artistas existentes con los predefinidos
                existing_ids = [a['id'] for a in artists]
                for artist in genre_specific_artists:
                    if artist['id'] not in existing_ids:
                        artists.append(artist)
                        if len(artists) >= limit:
                            break
            else:
                # Si no tenemos artistas, usar solo los predefinidos
                artists = genre_specific_artists

        # Limitar al número solicitado
        artists = artists[:limit]

        # Guardar en caché (sólo si hay artistas reales y no todos son
        # fallback)
        if use_cache and any(artist.get('source', '') ==
                             'youtube' for artist in artists):
            cache_key = f"artists_by_genre_{genre}_{limit}_{region}_{language}"
            save_to_cache(cache_key, artists)
            logger.info(
                f"[DEBUG] Resultados guardados en caché con clave: {cache_key}")

        logger.info(
            f"[DEBUG] Devolviendo {
        len(artists)} artistas para el género '{genre}'")
        return jsonify(artists)
    except Exception as e:
        logger.error(
            f"Error general en get_artists_by_genre para {genre} en región {region}: {e}")

        # En caso de error general, devolver directamente artistas predefinidos
        predefined_artists = get_predefined_artists_by_genre(
            genre, limit, region)
        logger.info(
            f"[DEBUG] Devolviendo {
        len(predefined_artists)} artistas predefinidos para el género '{genre}' debido a error")
        return jsonify(predefined_artists)


def get_region_keyword(region_code):
    """Devuelve una palabra clave basada en la región para mejorar los resultados de búsqueda"""
    region_keywords = {
        'ES': 'españa',
        'MX': 'méxico',
        'AR': 'argentina',
        'CO': 'colombia',
        'CL': 'chile',
        'US': 'usa',
        'GB': 'uk',
        'FR': 'francia',
        'DE': 'alemania',
        'IT': 'italia',
        'BR': 'brasil'
    }
    return region_keywords.get(region_code, '')


def get_predefined_artists_by_genre(genre, count, region='US'):
    """Devuelve artistas predefinidos según el género solicitado y la región"""
    # Base de artistas por género
    genre_artists = {
        'pop': [
            {'id': 'pop1', 'name': 'Taylor Swift', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb6a224073987b930f99adc8bc'}]},
            {'id': 'pop2', 'name': 'Ed Sheeran', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb3bcef85e105dfc42399ef0c2'}]},
            {'id': 'pop3', 'name': 'Ariana Grande', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5ebcdce7620dc940db079bf4952'}]},
            {'id': 'pop4', 'name': 'Justin Bieber', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb8ae7f2aaa9817a704a87ea36'}]}
        ],
        'rock': [
            {'id': 'rock1', 'name': 'Foo Fighters', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb8b9e05bd676878c8861f7828'}]},
            {'id': 'rock2', 'name': 'Arctic Monkeys', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb7da39dea0a72f581535fb11f'}]},
            {'id': 'rock3', 'name': 'Imagine Dragons', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb920dc1f617550de8388f368e'}]},
            {'id': 'rock4', 'name': 'Twenty One Pilots', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eba53ac4a3e0240306c2c33bae'}]}
        ],
        'hip hop': [
            {'id': 'hiphop1', 'name': 'Kendrick Lamar', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb6eb08a5d2495d9f7d429aee9'}]},
            {'id': 'hiphop2', 'name': 'Drake', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb4293385d324db8558179afd9'}]},
            {'id': 'hiphop3', 'name': 'J. Cole', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5ebadd503b411a712e277895c8a'}]},
            {'id': 'hiphop4', 'name': 'Travis Scott', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eba00b11c129b27a88fc72f36b'}]}
        ],
        'electronic': [
            {'id': 'edm1', 'name': 'Calvin Harris', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5ebc2b305a3560d6708dd8b7de0'}]},
            {'id': 'edm2', 'name': 'Martin Garrix', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb12a2ef08d00dd7451a6dbed6'}]},
            {'id': 'edm3', 'name': 'Daft Punk', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb10ca40ea0b0b5082dba0ff75'}]},
            {'id': 'edm4', 'name': 'Avicii', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5ebd212fe90e871fa11c232c3a6'}]}
        ],
        'indie': [
            {'id': 'indie1', 'name': 'Tame Impala', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5ebf87efa01ac7680a3fa7d0987'}]},
            {'id': 'indie2', 'name': 'The 1975', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb8197fc99bf4768c774d18c55'}]},
            {'id': 'indie3', 'name': 'Vampire Weekend', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb809b75d71c5e258695cef8c4'}]},
            {'id': 'indie4', 'name': 'MGMT', 'images': [
                {'url': 'https://i.scdn.co/image/ab6761610000e5eb68151ade82ce461f9f761a5e'}]}
        ]
    }

    # Artistas por región y género (para personalizar aún más los resultados)
    region_genre_artists = {
        'ES': {
            'pop': [
                {'id': 'es-pop1', 'name': 'Rosalía', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eb4a5844d12a6633fcce886ce2'}]},
                {'id': 'es-pop2', 'name': 'Aitana', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eb1af3fabbe3738a589d6f45de'}]},
                {'id': 'es-pop3', 'name': 'Pablo Alborán', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eb996e3a6acf0b2bec97b29f34'}]}
            ],
            'rock': [
                {'id': 'es-rock1', 'name': 'Leiva', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eb1f3c2b9c5fafe47fdb6dd2e3'}]},
                {'id': 'es-rock2', 'name': 'Izal', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eb32d0c0c92328b225d069534a'}]}
            ]
        },
        'MX': {
            'pop': [
                {'id': 'mx-pop1', 'name': 'Natalia Lafourcade', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eb9c0ac81650538c3a3f5c5536'}]},
                {'id': 'mx-pop2', 'name': 'Reik', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eba09a439764e2c2d5eb517de1'}]},
                {'id': 'mx-pop3', 'name': 'Jesse & Joy', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eba8c8f89da7b1c1fcc9e1c92e'}]}
            ]
        },
        'AR': {
            'pop': [
                {'id': 'ar-pop1', 'name': 'Tini', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5ebb6a2c7d2a2b38be4f4ede430'}]},
                {'id': 'ar-pop2', 'name': 'Lali', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eb1e34e6df777e8d4bd0269ed7'}]},
                {'id': 'ar-pop3', 'name': 'Nicki Nicole', 'images': [
                    {'url': 'https://i.scdn.co/image/ab6761610000e5eb21128629ebdb8ac427228921'}]}
            ]
        }
    }

    # Normalizar el género para la búsqueda
    normalized_genre = genre.lower()
    matched_genre = None

    for key in genre_artists:
        if key in normalized_genre or normalized_genre in key:
            matched_genre = key
            break

    # Intentar primero obtener artistas específicos por región y género
    region_specific_artists = []
    if region in region_genre_artists and matched_genre in region_genre_artists[region]:
        region_specific_artists = region_genre_artists[region][matched_genre]
        logger.info(
            f"Usando {
        len(region_specific_artists)} artistas específicos para región {region} y género {matched_genre}")

    # Si no encontramos un género específico, usar una mezcla de todos
    if not matched_genre:
        all_artists = []
        for genre_list in genre_artists.values():
            all_artists.extend(genre_list)
        # Mezclar la lista para variedad
        random.shuffle(all_artists)
        result = region_specific_artists + \
            all_artists[:max(0, count - len(region_specific_artists))]
    else:
        # Combinar artistas específicos de la región con artistas generales del
        # género
        general_genre_artists = genre_artists[matched_genre][:max(
            0, count - len(region_specific_artists))]
        result = region_specific_artists + general_genre_artists
        result = result[:count]  # Asegurarnos de no exceder el límite

    # Añadir información común a todos los artistas
    for artist in result:
        artist['genres'] = [genre]
        artist['popularity'] = 50
        artist['source'] = 'youtube'
        artist['region'] = region

    return result


@app.route('/status')
def health_check():
    """Endpoint para verificar la salud del servicio"""
    try:
        # Verificar si YTMusic está inicializado
        ytm = get_ytmusic()
        ytmusic_available = ytm is not None

        # Actualizar estado del servicio
        with setup_auth_lock:
            service_status["ytmusic_available"] = ytmusic_available
            service_status["last_check"] = datetime.now().isoformat()

        # Si YTMusic está disponible, intentar una consulta ligera para
        # verificar que realmente funciona
        test_results = None
        if ytmusic_available:
            try:
                # Intentar obtener una categoría de música como prueba rápida
                start_time = time.time()
                test_results = ytm.get_mood_categories()
                elapsed_time = time.time() - start_time

                has_results = test_results is not None and len(
                    test_results) > 0
                service_status["last_successful_operation"] = datetime.now(
                ).isoformat()
                service_status["last_test_time_ms"] = round(
                    elapsed_time * 1000)
                service_status["last_test_success"] = has_results
            except Exception as test_error:
                logger.error(f"Error en prueba de estado: {str(test_error)}")
                service_status["last_test_error"] = str(test_error)
                service_status["last_test_success"] = False

        # Construir respuesta de estado
        response = {
            "status": "ok" if ytmusic_available else "degraded",
            "ytmusic_available": ytmusic_available,
            "timestamp": datetime.now().isoformat(),
            "cache_status": {
                "cache_dir_exists": os.path.exists(CACHE_DIR),
                "cache_entries": len(os.listdir(CACHE_DIR)) if os.path.exists(CACHE_DIR) else 0
            },
            "service_info": {
                "initialization_attempts": service_status["initialization_attempts"],
                "last_successful_operation": service_status["last_successful_operation"],
                "last_test_success": service_status.get("last_test_success", None),
                "last_test_time_ms": service_status.get("last_test_time_ms", None),
                "python_api_version": "1.1.0"
            }
        }

        return jsonify(response)
    except Exception as e:
        # Registrar el error
        logger.error(f"Error en health check: {str(e)}")
        with setup_auth_lock:
            service_status["errors"].append({
                "timestamp": datetime.now().isoformat(),
                "error": str(e)
            })
            # Mantener solo los últimos 10 errores
            service_status["errors"] = service_status["errors"][-10:]

        # Devolver respuesta de error
        return jsonify({
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
            "ytmusic_available": False
        }), 500


# Ruta para obtener información detallada de un artista
@app.route('/api/youtube-artist', methods=['GET'])
def get_youtube_artist():
    """Obtiene información detallada de un artista en YouTube Music"""
    artist_id = request.args.get('artistId')
    use_cache = request.args.get('_t') is None  # Parámetro para bypass del caché
    language = request.args.get('language', 'es')
    
    if not artist_id:
        return jsonify({"error": "Se requiere un ID de artista"}), 400
    
    logger.info(f"[YouTube Artist] Obteniendo información del artista: {artist_id}")
    
    # Clave de caché
    cache_key = f"artist_detail_{artist_id}_{language}"
    
    # Verificar caché si está habilitado
    if use_cache:
        cached_data = get_cached(cache_key, ttl_hours=24)  # Caché por 24 horas
        if cached_data:
            logger.info(f"[YouTube Artist] Devolviendo datos en caché para artista: {artist_id}")
            return jsonify(cached_data)
    
    # Configuración de reintentos
    max_retries = 3
    retry_delay = 1  # segundos
    
    # Función para obtener datos con reintentos
    def get_with_retry(attempt=0):
        try:
            # Obtener instancia de YTMusic
            ytm = get_ytmusic()
            
            # Obtener información del artista
            start_time = time.time()
            artist_data = ytm.get_artist(artist_id)
            elapsed_time = time.time() - start_time
            
            logger.info(f"[YouTube Artist] Información obtenida en {elapsed_time:.2f}s")
            
            # Verificar que tenemos datos válidos
            if not artist_data or not isinstance(artist_data, dict) or 'name' not in artist_data:
                raise ValueError("Datos de artista inválidos o incompletos")
            
            # --- Añadir esta lógica ---
            # Crear el campo 'videos' a partir de 'songs' si existe, para compatibilidad con frontend
            if 'songs' in artist_data and isinstance(artist_data['songs'], dict):
                artist_data['videos'] = {
                    'results': artist_data['songs'].get('results', [])
                }
                logger.info(f"[YouTube Artist] Mapeado 'songs.results' a 'videos.results' para compatibilidad.")
            elif 'videos' not in artist_data:
                # Si no hay 'songs' ni 'videos', crear un campo 'videos' vacío
                 artist_data['videos'] = { 'results': [] }
                 logger.warning(f"[YouTube Artist] No se encontraron 'songs' ni 'videos' en la respuesta. Creando 'videos.results' vacío.")
            # --- Fin de la lógica añadida ---

            # Guardar en caché si está habilitado
            if use_cache:
                save_to_cache(cache_key, artist_data) # Guarda el artist_data modificado

            return artist_data # Retorna el artist_data modificado
        except KeyError as ke:
            # Manejar específicamente el error de musicImmersiveHeaderRenderer
            error_msg = str(ke)
            if 'musicImmersiveHeaderRenderer' in error_msg:
                logger.error(f"[YouTube Artist] Error en estructura de datos de YouTube Music: {error_msg}")
                
                # Si tenemos un fallback, intenta reconstruir datos mínimos del artista
                if attempt < max_retries - 1:
                    logger.info(f"[YouTube Artist] Reintentando en {retry_delay * (attempt + 1)}s...")
                    time.sleep(retry_delay * (attempt + 1))
                    return get_with_retry(attempt + 1)
                else:
                    # En el último intento, construir una respuesta mínima con los datos disponibles
                    logger.warning(f"[YouTube Artist] Creando respuesta mínima para el artista {artist_id}")
                    
                    # Intentar obtener al menos el nombre del artista mediante búsqueda
                    try:
                        # Extraer términos de búsqueda potenciales del ID
                        search_term = None
                        if artist_id.startswith("UC"):
                            # Si es un canal de YouTube, buscar por ese ID
                            search_results = ytm.search(artist_id, filter="artists", limit=1)
                        else:
                            # Intentar buscar por nombre si se proporcionó en la URL o en headers
                            artist_name = request.args.get('artistName')
                            if artist_name:
                                search_results = ytm.search(artist_name, filter="artists", limit=1)
                                search_term = artist_name
                            else:
                                # Si no hay nombre, devolver un objeto mínimo
                                return {
                                    "id": artist_id,
                                    "name": "Artista no encontrado",
                                    "thumbnails": [],
                                    "error_cause": "musicImmersiveHeaderRenderer_not_found",
                                    "description": "No se pudo obtener información detallada del artista debido a cambios en la API de YouTube Music"
                                }
                        
                        if search_results and len(search_results) > 0:
                            artist_result = search_results[0]
                            logger.info(f"[YouTube Artist] Usando datos mínimos de búsqueda: {artist_result.get('name', 'Desconocido')}")
                            
                            return {
                                "id": artist_id,
                                "name": artist_result.get('name', 'Artista desconocido'),
                                "thumbnails": artist_result.get('thumbnails', []),
                                "partial_data": True,
                                "subscribers": "Desconocido",
                                "warning": "Datos parciales debido a cambios en la API de YouTube Music"
                            }
                    except Exception as search_error:
                        logger.error(f"[YouTube Artist] Error al buscar datos alternativos: {search_error}")
                    
                    # Si todo falla, devolver un objeto mínimo
                    return {
                        "id": artist_id,
                        "name": "Artista no encontrado",
                        "thumbnails": [],
                        "error_cause": "musicImmersiveHeaderRenderer_not_found",
                        "description": "No se pudo obtener información detallada del artista debido a cambios en la API de YouTube Music"
                    }
            else:
                # Otros errores de clave
                logger.error(f"[YouTube Artist] Error en intento {attempt+1}/{max_retries}: {error_msg}")
                
                if attempt < max_retries - 1:
                    sleep_time = retry_delay * (attempt + 1)
                    logger.info(f"[YouTube Artist] Reintentando en {sleep_time}s...")
                    time.sleep(sleep_time)
                    return get_with_retry(attempt + 1)
                else:
                    raise
        except Exception as e:
            logger.error(f"[YouTube Artist] Error en intento {attempt+1}/{max_retries}: {str(e)}")
            
            # Si aún tenemos reintentos disponibles
            if attempt < max_retries - 1:
                sleep_time = retry_delay * (attempt + 1)
                logger.info(f"[YouTube Artist] Reintentando en {sleep_time}s...")
                time.sleep(sleep_time)
                return get_with_retry(attempt + 1)
            else:
                # Propagar el error después del último intento
                raise
    
    try:
        # Obtener datos con reintentos
        artist_data = get_with_retry()
        
        # Formatear y normalizar datos
        formatted_data = {
            "id": artist_id,
            "name": artist_data.get("name", "Artista Desconocido"),
            "description": artist_data.get("description", ""),
            "subscribers": artist_data.get("subscribers", "0"),
            "thumbnails": artist_data.get("thumbnails", []),
            "views": artist_data.get("views", "0"),
            "source": "youtube_music"
        }
        
        # Agregar secciones de contenido si existen
        for content_type in ["songs", "albums", "singles", "videos", "related"]:
            if content_type in artist_data:
                formatted_data[content_type] = artist_data[content_type]
        
        # Guardar en caché
        save_to_cache(cache_key, formatted_data)
        
        logger.info(f"[YouTube Artist] Datos formateados para artista: {artist_id}")
        return jsonify(formatted_data)
    
    except Exception as e:
        logger.error(f"[YouTube Artist] Error final al obtener información del artista {artist_id}: {str(e)}")
        
        # Verificar si tenemos datos en caché aun con tiempos de vida mayores
        fallback_cache = get_cached(cache_key, ttl_hours=72)  # Intentar usar caché con TTL extendido
        if fallback_cache:
            logger.info(f"[YouTube Artist] Usando caché antiguo como fallback para: {artist_id}")
            return jsonify({
                **fallback_cache,
                "warning": "Datos obtenidos de caché antiguo debido a un error en la API"
            })
        
        # Devolver respuesta de error
        return jsonify({
            "error": f"Error al obtener información del artista: {str(e)}",
            "id": artist_id,
            "source": "youtube_music"
        }), 500


@app.route('/api/watch-playlist', methods=['GET'])
def get_watch_playlist():
    video_id = request.args.get('videoId')
    limit = request.args.get('limit', type=int, default=25)

    if not video_id:
        logger.warning("get_watch_playlist: Falta videoId")
        return jsonify({'error': 'Se requiere el parámetro videoId'}), 400

    logger.info(f"Obteniendo watch playlist para videoId: {video_id}")

    try:
        yt = get_ytmusic() # Obtener instancia inicializada
        # Limitar la cantidad de resultados para evitar sobrecarga
        playlist_data = yt.get_watch_playlist(videoId=video_id, limit=limit)
        
        # Verificar si la respuesta es válida (puede ser None o dict vacío si falla)
        if not playlist_data or not playlist_data.get('tracks'):
             logger.warning(f"No se encontró watch playlist o tracks para videoId: {video_id}")
             # Devolver un error 404 si no se encuentra la playlist
             return jsonify({'error': f'No se encontró playlist de reproducción para videoId: {video_id}'}), 404

        logger.info(f"Watch playlist obtenida con {len(playlist_data.get('tracks', []))} tracks para videoId: {video_id}")
        # Devolver directamente la respuesta de ytmusicapi
        return jsonify(playlist_data)

    except Exception as e:
        # Capturar cualquier excepción durante la llamada a ytmusicapi
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(f"Error en get_watch_playlist para videoId {video_id}: {error_type} - {error_msg}")
        
        # Determinar código de estado HTTP basado en el error (ejemplo simple)
        status_code = 500 # Error interno del servidor por defecto
        if "authenticate" in error_msg.lower():
            status_code = 401 # No autorizado
        elif "not found" in error_msg.lower() or error_type == 'KeyError':
             status_code = 404 # No encontrado
        elif "network error" in error_msg.lower() or "timeout" in error_msg.lower():
             status_code = 503 # Servicio no disponible (problema de red)
             
        # Devolver respuesta JSON estandarizada con código de error
        return jsonify({'error': f'Error al obtener playlist de reproducción: {error_msg}'}), status_code

@app.route('/api/lyrics', methods=['GET'])
def get_lyrics():
    """
    Obtiene las letras de una canción usando el browseId
    El parámetro timestamps determina si se devuelven letras con timestamps o no
    """
    browse_id = request.args.get('browseId', '')
    timestamps = request.args.get('timestamps', 'false').lower() == 'true'
    
    if not browse_id:
        return jsonify({"error": "Se requiere browseId"}), 400
    
    if not browse_id.startswith('MPLY'):
        return jsonify({"error": "El browseId proporcionado no es válido para letras"}), 400
    
    logger.info(f"[YTMUSIC] Obteniendo letras para browseId: {browse_id} (timestamps: {timestamps})")
    
    try:
        ytmusic = get_ytmusic()
        
        # Obtener las letras
        lyrics = ytmusic.get_lyrics(browse_id, timestamps=timestamps)
        
        if not lyrics:
            logger.info("[YTMUSIC] No se encontraron letras")
            return jsonify({"error": "No se encontraron letras"}), 404
        
        logger.info(f"[YTMUSIC] Letras obtenidas correctamente (con timestamps: {lyrics.get('hasTimestamps', False)})")
        
        return jsonify(lyrics)
    except Exception as e:
        logger.error(f"[YTMUSIC] Error al obtener letras: {str(e)}")
        return jsonify({"error": f"Error: {str(e)}"}), 500

@app.route('/api/get_mood_categories', methods=['GET'])
def get_mood_categories():
    try:
        ytmusic = YTMusic()
        categories = ytmusic.get_mood_categories()
        return jsonify(categories)
    except Exception as e:
        app.logger.error(f"Error getting mood categories: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get_mood_playlists', methods=['GET'])
def get_mood_playlists():
    try:
        params = request.args.get('params')
        if not params:
            return jsonify({"error": "Params parameter is required"}), 400
            
        ytmusic = YTMusic()
        playlists = ytmusic.get_mood_playlists(params)
        return jsonify(playlists)
    except Exception as e:
        app.logger.error(f"Error getting mood playlists: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get_charts', methods=['GET'])
def get_charts_api():
    try:
        country = request.args.get('country', 'ZZ')
        ytmusic = YTMusic()
        charts = ytmusic.get_charts(country)
        return jsonify(charts)
    except Exception as e:
        app.logger.error(f"Error getting charts: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Certificado SSL
    context = None
    try:
        # Intentar configurar SSL si los certificados existen
        cert_path = os.path.join(
            os.path.dirname(
        os.path.abspath(__file__)),
            'cert')
        if os.path.exists(
            os.path.join(
        cert_path,
        'cert.pem')) and os.path.exists(
            os.path.join(
                cert_path,
                'key.pem')):
            context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
            context.load_cert_chain(
                os.path.join(cert_path, 'cert.pem'),
                os.path.join(cert_path, 'key.pem')
            )
            print("Usando certificados SSL")
    except Exception as e:
        print(f"Error configurando SSL: {e}")
        context = None

    # Iniciar el servidor
    if context:
        app.run(host='0.0.0.0', port=5000, ssl_context=context, debug=True)
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)
