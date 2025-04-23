#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Script de prueba para ytmusicapi que verifica la funcionalidad de búsqueda
y obtención de información de artista para TINI
"""

import os
import sys
import json
import logging
from ytmusicapi import YTMusic

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("ytmusic_test")


def setup_ytmusic():
    """Inicializar YTMusic sin autenticación (modo no autenticado)"""
    logger.info("Inicializando YTMusic")
    try:
        ytmusic = YTMusic()
        logger.info("YTMusic inicializado correctamente")
        return ytmusic
    except Exception as e:
        logger.error(f"Error al inicializar YTMusic: {e}")
        sys.exit(1)


def search_artist(ytmusic, query="TINI"):
    """Buscar un artista por nombre"""
    logger.info(f"Realizando búsqueda de: {query}")
    try:
        # Realizar búsqueda filtrada solo para artistas
        results = ytmusic.search(query, filter="artists")
        logger.info(f"Resultados encontrados: {len(results)}")

        # Mostrar los primeros resultados
        for i, result in enumerate(results[:5], 1):
            logger.info(f"Resultado {i}: {result.get('name', 'Sin nombre')} - {result.get('artist', 'Desconocido')}")
            logger.debug(f"Detalles completos: {json.dumps(result, indent=2, ensure_ascii=False)}")

        # Devolver el primer resultado si existe
        if results:
            return results[0]
        return None
    except Exception as e:
        logger.error(f"Error en la búsqueda: {e}")
        return None


def get_artist_details(ytmusic, artist_id):
    """Obtener información detallada del artista"""
    logger.info(f"Obteniendo detalles del artista ID: {artist_id}")
    try:
        # Llamar directamente al método get_artist
        artist_data = ytmusic.get_artist(artist_id)

        # Comprobar si la respuesta contiene los campos esperados
        if artist_data and isinstance(artist_data, dict):
            logger.info(f"Artista encontrado: {artist_data.get('name', 'Desconocido')}")

            # Verificar campos principales
            required_fields = [
                "name",
                "description",
                "thumbnails",
                "songs",
                "albums",
                "singles",
                "videos",
            ]
            for field in required_fields:
                if field in artist_data:
                    type_info = type(artist_data[field]).__name__
                    if field in ["songs", "albums", "singles", "videos"] and "results" in artist_data[field]:
                        count = len(artist_data[field]["results"])
                        logger.info(f"Campo '{field}' presente: {type_info} con {count} resultados")
                    else:
                        logger.info(f"Campo '{field}' presente: {type_info}")
                else:
                    logger.warning(f"Campo '{field}' no encontrado en la respuesta")

            # Guardar resultado completo en archivo para análisis
            output_file = os.path.join(os.path.dirname(__file__), f"artist_{artist_id}.json")
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(artist_data, f, indent=2, ensure_ascii=False)
            logger.info(f"Datos completos guardados en: {output_file}")

            return artist_data
        else:
            logger.error(f"Respuesta inesperada: {type(artist_data).__name__}")
            return None
    except KeyError as ke:
        # Captura específica para el error musicImmersiveHeaderRenderer
        error_msg = str(ke)
        if "musicImmersiveHeaderRenderer" in error_msg:
            logger.error(f"Error de estructura en la API de YouTube Music: {error_msg}")
            logger.error("Este es un problema conocido con cambios en la estructura interna de YouTube Music")
            # Guardar detalle del error
            with open(os.path.join(os.path.dirname(__file__), "error_detail.json"), "w") as f:
                json.dump({"error": error_msg, "artist_id": artist_id}, f, indent=2)
        else:
            logger.error(f"Error de clave inesperado: {error_msg}")
        return None
    except Exception as e:
        logger.error(f"Error al obtener detalles del artista: {e}")
        return None


def search_by_channel_id(ytmusic, channel_id="UCo1CyRi6fFQBUXUAxt4t9EA"):
    """Intentar encontrar el artista por channel_id de YouTube
    (Este es el ID de TINI en YouTube)"""
    logger.info(f"Buscando por YouTube channel ID: {channel_id}")
    try:
        # Para channel ID, podemos intentar prefijar con UC si no lo tiene
        if not channel_id.startswith("UC"):
            channel_id = f"UC{channel_id}"

        # Intento directo con get_artist
        try:
            artist = ytmusic.get_artist(channel_id)
            return artist
        except Exception as e:
            logger.error(f"Error al intentar obtener artista directamente por channel_id: {e}")

        # Intento alternativo: buscar por channel_id como texto
        results = ytmusic.search(channel_id, filter="artists")
        if results:
            logger.info(f"Se encontraron {len(results)} resultados buscando por channel_id")
            return results[0]
        return None
    except Exception as e:
        logger.error(f"Error al buscar por channel_id: {e}")
        return None


def main():
    """Función principal"""
    logger.info("Iniciando prueba de ytmusicapi")

    # Inicializar YTMusic
    ytmusic = setup_ytmusic()

    # Buscar TINI
    search_term = "TINI"
    search_result = search_artist(ytmusic, search_term)

    if search_result:
        logger.info(f"Artista encontrado en búsqueda: {search_result.get('name')}")
        logger.info(f"ID del artista: {search_result.get('browseId')}")

        # Obtener detalles del artista
        artist_id = search_result.get("browseId")
        if artist_id:
            artist_details = get_artist_details(ytmusic, artist_id)
            if artist_details:
                logger.info("Detalles del artista obtenidos correctamente")
            else:
                logger.error("No se pudieron obtener los detalles del artista")

                # Intento alternativo con channel_id conocido de TINI
                logger.info("Intentando método alternativo...")
                # Este es el ID de canal de TINI en YouTube
                tini_channel_id = "UCo1CyRi6fFQBUXUAxt4t9EA"
                alternative_result = search_by_channel_id(ytmusic, tini_channel_id)
                if alternative_result:
                    logger.info("Encontrado mediante método alternativo")
    else:
        logger.error(f"No se encontraron resultados para '{search_term}'")

    # Intentar también con la búsqueda general para verificar
    logger.info("Realizando búsqueda general para verificar API")
    general_results = ytmusic.search("daft punk", limit=20)
    logger.info(f"Resultados encontrados para búsqueda general: {len(general_results)}")

    logger.info("Prueba completada")


if __name__ == "__main__":
    main()
