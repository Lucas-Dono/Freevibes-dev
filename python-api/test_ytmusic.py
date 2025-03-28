"""
Script de prueba para verificar la funcionalidad de ytmusicapi
"""
import logging
from ytmusicapi import YTMusic

# Configurar logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('ytmusic_test')

def main():
    logger.info("Iniciando prueba de ytmusicapi")
    
    try:
        logger.info("Inicializando YTMusic")
        yt = YTMusic()
        logger.info("YTMusic inicializado correctamente")
        
        query = "daft punk"
        logger.info(f"Realizando búsqueda de: {query}")
        results = yt.search(query, filter="songs", limit=5)
        
        logger.info(f"Resultados encontrados: {len(results)}")
        for i, result in enumerate(results):
            logger.info(f"Resultado {i+1}: {result.get('title', 'Sin título')} - {result.get('artists', [{'name': 'Desconocido'}])[0]['name']}")
        
        logger.info("Prueba completada con éxito")
    except Exception as e:
        logger.error(f"Error durante la prueba: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    main() 