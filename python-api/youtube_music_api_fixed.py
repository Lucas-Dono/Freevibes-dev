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

# Configurar logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("youtube_music_api")

app = Flask(__name__)
CORS(app)  # Habilitamos CORS para permitir peticiones desde el frontend

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
cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
os.makedirs(cache_dir, exist_ok=True)

# Duración del caché en segundos
CACHE_DURATION = 3600  # 1 hora


# Decorador para caché
def cached(cache_file):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Obtener la región si está presente en los args de request
            region = request.args.get("region", "default")
            # Crear nombre de caché específico para la región
            region_cache_file = f"{region}_{cache_file}"
            cache_path = os.path.join(CACHE_DIR, region_cache_file)

            try:
                # Verificar si existe un caché válido
                if os.path.exists(cache_path):
                    with open(cache_path, "r") as f:
                        cached_data = json.load(f)

                    # Verificar si el caché está vigente
                    if time.time() - cached_data.get("timestamp", 0) < CACHE_DURATION:
                        logger.info(f"Usando caché para {func.__name__} con región {region}")
                        # Importante: devolver como jsonify para que sea una respuesta válida
                        return jsonify(cached_data.get("data"))

                # Si no hay caché o expiró, ejecutar función
                result = func(*args, **kwargs)

                # Extraer los datos JSON si es una respuesta Flask
                if hasattr(result, "get_json"):
                    data_to_cache = result.get_json()
                else:
                    data_to_cache = result

                # Guardar en caché
                with open(cache_path, "w") as f:
                    json.dump({"timestamp": time.time(), "data": data_to_cache}, f)

                return result
            except Exception as e:
                logger.error(f"Error en caché para {func.__name__}: {str(e)}")
                # Si hay un error en la caché, intentar ejecutar la función directamente
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
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if datetime.fromisoformat(data["timestamp"]) + timedelta(hours=ttl_hours) > datetime.now():
                    return data["content"]
        except UnicodeDecodeError:
            logger.warning(f"Error de codificación al leer el caché: {cache_file}. Eliminando archivo.")
            try:
                os.remove(cache_file)
            except:
                logger.error(f"No se pudo eliminar el archivo de caché corrupto: {cache_file}")
        except json.JSONDecodeError:
            logger.warning(f"Error de formato JSON en caché: {cache_file}. Eliminando archivo.")
            try:
                os.remove(cache_file)
            except:
                logger.error(f"No se pudo eliminar el archivo de caché corrupto: {cache_file}")
        except Exception as e:
            logger.error(f"Error inesperado leyendo caché: {str(e)}")
    return None


def save_to_cache(key, content):
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(
                {"timestamp": datetime.now().isoformat(), "content": content},
                f,
                ensure_ascii=False,
            )
            logger.debug(f"Datos guardados en caché: {key}")
    except Exception as e:
        logger.error(f"Error guardando caché para {key}: {str(e)}")
        # Intentar eliminar el archivo si existe y hay error al escribir
        try:
            if os.path.exists(cache_file):
                os.remove(cache_file)
        except:
            pass


def get_cache_file_path(key):
    """Genera una ruta de archivo para la clave de caché dada"""
    # Convertir la clave a un nombre de archivo válido
    cache_key = key.replace("/", "_").replace("?", "_").replace("=", "_")
    return os.path.join(cache_dir, f"{cache_key}.json")


def get_cached_results(key):
    """Obtiene resultados cacheados si existen y no han expirado"""
    cache_file = get_cache_file_path(key)

    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached_data = json.load(f)

            # Verificar si el caché ha expirado
            cache_time = cached_data.get("timestamp", 0)
            if time.time() - cache_time < CACHE_DURATION:
                print(f"Cache hit para {key}")
                return cached_data.get("data")
            else:
                print(f"Cache expirado para {key}")
        except Exception as e:
            print(f"Error leyendo caché para {key}: {e}")

    return None


def get_best_thumbnail(thumbnails):
    """Obtiene la mejor calidad de thumbnail disponible"""
    if not thumbnails:
        return ""

    # Ordenar por tamaño (width * height) de mayor a menor
    sorted_thumbnails = sorted(
        [t for t in thumbnails if "width" in t and "height" in t and "url" in t],
        key=lambda x: x["width"] * x["height"],
        reverse=True,
    )

    # Devolver la URL del más grande, o el primero disponible
    if sorted_thumbnails:
        return sorted_thumbnails[0]["url"]
    elif thumbnails and "url" in thumbnails[0]:
        return thumbnails[0]["url"]
    return ""


@app.route("/api/find-track", methods=["GET"])
def find_track():
    """Busca una canción y devuelve su información"""
    title = request.args.get("title", "")
    artist = request.args.get("artist", "")
    query = request.args.get("q", f"{title} {artist}").strip()

    # Si no hay consulta válida, devolver error
    if not query:
        return (
            jsonify({"error": "Se requiere un parámetro de búsqueda: title y artist, o q"}),
            400,
        )

    # Verificar caché
    cache_key = f"track_{query}"
    cached_track = get_cached(cache_key, ttl_hours=168)  # 1 semana de caché
    if cached_track:
        logger.info(f"[RASTREO-PLAYLIST] Usando caché para: '{query}'")
        return jsonify(cached_track)

    try:
        # Log de inicio
        logger.info(f"[RASTREO-PLAYLIST] BÚSQUEDA: Iniciando para: '{query}'")
        region = request.args.get("region", "US")
        language = request.args.get("language", "es")

        logger.info(f"[RASTREO-PLAYLIST] Configuración: region={region}, language={language}")

        start_time = time.time()
        music = YTMusic(language=language)

        # Buscar con tipo "songs" y límite pequeño
        logger.info(f"[RASTREO-PLAYLIST] Ejecutando búsqueda con params: query='{query}', filter='songs', limit=5")
        search_results = music.search(query, filter="songs", limit=5)
        search_duration = time.time() - start_time

        # Loguear información sobre los resultados
        if search_results:
            logger.info(f"[RASTREO-PLAYLIST] ÉXITO: {len(search_results)} resultados en {search_duration:.2f}s")
            logger.info(
                f"[RASTREO-PLAYLIST] Primer resultado: "
                + f"title='{search_results[0].get('title', '')}', "
                + f"artist='{search_results[0].get('artists', [{'name': 'Desconocido'}])[0].get('name', 'Desconocido')}'"
            )
        else:
            logger.warning(f"[RASTREO-PLAYLIST] Sin resultados para query='{query}' en {search_duration:.2f}s")

        if search_results and len(search_results) > 0:
            # Tomar el primer resultado como el más relevante
            best_match = search_results[0]

            # Extraer información detallada del mejor resultado
            video_id = best_match.get("videoId", "")
            match_title = best_match.get("title", title)
            match_artist = best_match.get("artists", [{"name": artist or "Artista desconocido"}])[0].get(
                "name", artist or "Artista desconocido"
            )
            match_album = best_match.get("album", {}).get("name", "") if best_match.get("album") else ""

            logger.info(
                f"[RASTREO-PLAYLIST] MEJOR RESULTADO: videoId='{video_id}', "
                + f"title='{match_title}', artist='{match_artist}', album='{match_album}'"
            )

            track_info = {
                "id": video_id,
                "title": match_title,
                "artist": match_artist,
                "album": match_album,
                "thumbnail": get_best_thumbnail(best_match.get("thumbnails", [])),
                "duration": best_match.get("duration", ""),
            }

            # Guardar en caché solo si tenemos un ID válido
            if track_info["id"]:
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
                "id": "",
                "title": title,
                "artist": artist,
                "error": "No se encontraron resultados",
            }
            return jsonify(fallback_result)

    except Exception as e:
        logger.error(f"[RASTREO-PLAYLIST] ERROR CRÍTICO en find_track: {str(e)}")
        import traceback

        logger.error(f"[RASTREO-PLAYLIST] Traceback: {traceback.format_exc()}")
        return (
            jsonify(
                {
                    "id": "",
                    "title": title,
                    "artist": artist,
                    "error": f"Error al buscar: {str(e)}",
                }
            ),
            500,
        )


@app.route("/api/spotify-to-youtube", methods=["GET"])
def spotify_to_youtube():
    """Convierte un track de Spotify a YouTube Music"""
    spotify_id = request.args.get("id", "")
    title = request.args.get("title", "")
    artist = request.args.get("artist", "")

    if not spotify_id and (not title or not artist):
        return jsonify({"error": "Se requiere ID de Spotify o título y artista"}), 400

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
            "youtube_id": "dQw4w9WgXcQ",
            "spotify_id": spotify_id,
            "title": title or "Título simulado",
            "artist": artist or "Artista simulado",
            "duration": 180,  # 3 minutos en segundos
            "thumbnail": "https://via.placeholder.com/150",
        }

        save_to_cache(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/recommendations", methods=["GET"])
def get_recommendations():
    """Obtiene recomendaciones variadas"""
    logger.info("[RASTREO-PLAYLIST] INICIO get_recommendations")

    # Parámetros
    limit = int(request.args.get("limit", 50))
    seed_artist = request.args.get("seed_artist", "")
    seed_track = request.args.get("seed_track", "")

    logger.info(f"[RASTREO-PLAYLIST] Parámetros: limit={limit}, seed_artist='{seed_artist}', seed_track='{seed_track}'")

    # Verificar caché
    cache_key = f"recommendations_{seed_artist}_{seed_track}_{limit}"

    try:
        # Menor tiempo para recomendaciones
        cached = get_cached(cache_key, ttl_hours=6)
        if cached:
            logger.info(f"[RASTREO-PLAYLIST] CACHÉ: Usando resultados en caché para recomendaciones")
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
                logger.info(f"[RASTREO-PLAYLIST] Buscando artista: '{seed_artist}'")
                artist_results = ytm.search(seed_artist, filter="artists", limit=1)

                if artist_results and len(artist_results) > 0:
                    artist_id = artist_results[0].get("browseId")
                    logger.info(f"[RASTREO-PLAYLIST] ID de artista encontrado: {artist_id}")

                    if artist_id:
                        logger.info(f"[RASTREO-PLAYLIST] Obteniendo top tracks del artista: {artist_id}")
                        try:
                            start_time = time.time()
                            artist_songs = ytm.get_artist(artist_id).get("songs", {}).get("results", [])
                            artist_time = time.time() - start_time

                            logger.info(f"[RASTREO-PLAYLIST] Obtenidos {len(artist_songs)} tracks en {artist_time:.2f}s")

                            for song in artist_songs:
                                if "videoId" in song:
                                    track_data = {
                                        "id": song["videoId"],
                                        "title": song.get("title", "Sin título"),
                                        "artist": song.get("artist", seed_artist),
                                        "thumbnail": get_best_thumbnail(song.get("thumbnails", [])),
                                        "duration": song.get("duration", ""),
                                        "source": "artist_track",
                                    }
                                    results.append(track_data)
                        except Exception as artist_error:
                            logger.error(f"[RASTREO-PLAYLIST] Error obteniendo tracks del artista: {str(artist_error)}")
            except Exception as artist_search_error:
                logger.error(f"[RASTREO-PLAYLIST] Error en búsqueda de artista: {str(artist_search_error)}")

        # Si tenemos una semilla de canción o si no conseguimos resultados por artista
        if seed_track or (seed_artist and len(results) == 0):
            try:
                query = seed_track if seed_track else seed_artist
                logger.info(f"[RASTREO-PLAYLIST] Buscando canción similar a: '{query}'")

                search_results = ytm.search(query, filter="songs", limit=1)

                if search_results and len(search_results) > 0:
                    video_id = search_results[0].get("videoId")

                    if video_id:
                        logger.info(f"[RASTREO-PLAYLIST] Encontrado video ID: {video_id}, obteniendo recomendaciones")

                        try:
                            start_time = time.time()
                            watch_playlist = ytm.get_watch_playlist(video_id)
                            watch_time = time.time() - start_time

                            tracks = watch_playlist.get("tracks", [])
                            logger.info(f"[RASTREO-PLAYLIST] Obtenidas {len(tracks)} recomendaciones en {watch_time:.2f}s")

                            for track in tracks:
                                if track.get("videoId") != video_id:  # Excluir la canción original
                                    track_data = {
                                        "id": track.get("videoId", ""),
                                        "title": track.get("title", "Sin título"),
                                        "artist": track.get("author", ""),
                                        "thumbnail": get_best_thumbnail(track.get("thumbnails", [])),
                                        "duration": track.get("length", ""),
                                        "source": "video_recommendation",
                                    }
                                    results.append(track_data)
                        except Exception as watch_error:
                            logger.error(f"[RASTREO-PLAYLIST] Error obteniendo playlist de watch: {str(watch_error)}")
            except Exception as track_search_error:
                logger.error(f"[RASTREO-PLAYLIST] Error en búsqueda de canción: {str(track_search_error)}")

        # Si aún no tenemos suficientes resultados, añadir recomendaciones generales
        if len(results) < limit:
            logger.info(f"[RASTREO-PLAYLIST] No hay suficientes recomendaciones ({len(results)}), añadiendo generales")

            try:
                suggestions = ytm.get_mood_categories()

                if suggestions:
                    logger.info(f"[RASTREO-PLAYLIST] Encontradas {len(suggestions)} categorías de mood")

                    for category in suggestions[:2]:  # Tomar solo las primeras 2 categorías
                        if "params" in category:
                            try:
                                mood_playlists = ytm.get_mood_playlists(category["params"])

                                if mood_playlists and "playlists" in mood_playlists:
                                    logger.info(
                                        f"[RASTREO-PLAYLIST] Categoría '{category.get('title', '')}': {len(mood_playlists['playlists'])} playlists"
                                    )

                                    # Tomar la primera playlist de cada categoría
                                    if mood_playlists["playlists"]:
                                        playlist = mood_playlists["playlists"][0]

                                        if "browseId" in playlist:
                                            try:
                                                playlist_tracks = ytm.get_playlist(playlist["browseId"], limit=10)

                                                if "tracks" in playlist_tracks:
                                                    logger.info(
                                                        f"[RASTREO-PLAYLIST] Obtenidas {len(playlist_tracks['tracks'])} tracks de mood"
                                                    )

                                                    for track in playlist_tracks["tracks"]:
                                                        if "videoId" in track:
                                                            track_data = {
                                                                "id": track["videoId"],
                                                                "title": track.get(
                                                                    "title",
                                                                    "Sin título",
                                                                ),
                                                                "artist": (
                                                                    ", ".join(
                                                                        [
                                                                            a.get(
                                                                                "name",
                                                                                "",
                                                                            )
                                                                            for a in track.get(
                                                                                "artists",
                                                                                [],
                                                                            )
                                                                        ]
                                                                    )
                                                                    if "artists" in track
                                                                    else "Artista desconocido"
                                                                ),
                                                                "thumbnail": get_best_thumbnail(track.get("thumbnails", [])),
                                                                "duration": track.get("duration", ""),
                                                                "source": f"mood_{category.get('title', 'general')}",
                                                            }
                                                            results.append(track_data)

                                                            # Si ya tenemos suficientes, salir
                                                            if len(results) >= limit:
                                                                break
                                            except Exception as playlist_error:
                                                logger.error(
                                                    f"[RASTREO-PLAYLIST] Error obteniendo playlist de mood: {str(playlist_error)}"
                                                )
                            except Exception as mood_error:
                                logger.error(f"[RASTREO-PLAYLIST] Error obteniendo playlists de mood: {str(mood_error)}")

                        # Si ya tenemos suficientes, salir del bucle de categorías
                        if len(results) >= limit:
                            break
            except Exception as mood_cat_error:
                logger.error(f"[RASTREO-PLAYLIST] Error obteniendo categorías de mood: {str(mood_cat_error)}")

        # Limitar resultados
        final_results = results[:limit]
        logger.info(f"[RASTREO-PLAYLIST] Devolviendo {len(final_results)} recomendaciones totales")

        # Guardar en caché
        try:
            save_to_cache(cache_key, final_results)
        except Exception as save_error:
            logger.warning(f"[RASTREO-PLAYLIST] Error guardando recomendaciones en caché: {str(save_error)}")

        return jsonify(final_results)
    except Exception as e:
        logger.error(f"[RASTREO-PLAYLIST] ERROR en get_recommendations: {str(e)}")
        import traceback

        logger.error(f"[RASTREO-PLAYLIST] Traceback: {traceback.format_exc()}")
        return jsonify([]), 500


if __name__ == "__main__":
    app.run(debug=True, port=8000)
