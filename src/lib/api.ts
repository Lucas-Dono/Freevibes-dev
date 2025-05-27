/**
 * Opciones para las llamadas a la API
 */
interface ApiOptions {
    limit?: number;
    offset?: number;
    locale?: string;
    market?: string;
}

/**
 * Obtiene playlists destacadas
 * @param options Opciones adicionales (límite, etc.)
 */
export const getFeaturedPlaylists = async (options: ApiOptions = {}) => {
    try {
        const response = await fetch(`/api/spotify?action=featured&limit=${options.limit || 20}&offset=${options.offset || 0}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API Cliente] Error en petición de playlists destacadas:', errorText);
            throw new Error(`Error al obtener playlists destacadas: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[API Cliente] Error en getFeaturedPlaylists:', error);
        throw error;
    }
};

/**
 * Obtiene nuevos lanzamientos
 * @param options Opciones adicionales (límite, etc.)
 */
export const getNewReleases = async (options: ApiOptions = {}) => {
    try {
        const response = await fetch(`/api/spotify?action=new-releases&limit=${options.limit || 20}&offset=${options.offset || 0}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API Cliente] Error en petición de nuevos lanzamientos:', errorText);
            throw new Error(`Error al obtener nuevos lanzamientos: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[API Cliente] Error en getNewReleases:', error);
        throw error;
    }
};

/**
 * Busca playlists por término
 * @param query Término de búsqueda
 * @param options Opciones adicionales (límite, etc.)
 */
export const searchPlaylists = async (query: string, options: ApiOptions = {}) => {
    try {
        const response = await fetch(`/api/spotify?action=search&type=playlist&q=${encodeURIComponent(query)}&limit=${options.limit || 20}&offset=${options.offset || 0}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API Cliente] Error en búsqueda de playlists:', errorText);
            throw new Error(`Error al buscar playlists: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[API Cliente] Error en searchPlaylists:', error);
        throw error;
    }
};

/**
 * Obtiene detalles de una playlist
 * @param playlistId ID de la playlist
 */
export const getPlaylistDetails = async (playlistId: string) => {
    try {
        const response = await fetch(`/api/spotify?action=playlist&id=${playlistId}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API Cliente] Error al obtener detalles de playlist:', errorText);
            throw new Error(`Error al obtener detalles de playlist: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[API Cliente] Error en getPlaylistDetails:', error);
        throw error;
    }
};

/**
 * Obtiene pistas de una playlist
 * @param playlistId ID de la playlist
 * @param options Opciones adicionales (límite, etc.)
 */
export const getPlaylistTracks = async (playlistId: string, options: ApiOptions = {}) => {
    try {
        const response = await fetch(`/api/spotify?action=playlist-tracks&id=${playlistId}&limit=${options.limit || 100}&offset=${options.offset || 0}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API Cliente] Error al obtener pistas de playlist:', errorText);
            throw new Error(`Error al obtener pistas de playlist: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[API Cliente] Error en getPlaylistTracks:', error);
        throw error;
    }
};

/**
 * Busca pistas por término
 * @param query Término de búsqueda
 * @param options Opciones adicionales (límite, etc.)
 */
export const searchTracks = async (query: string, options: ApiOptions = {}) => {
    try {
        const response = await fetch(`/api/spotify?action=search&type=track&q=${encodeURIComponent(query)}&limit=${options.limit || 20}&offset=${options.offset || 0}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[API Cliente] Error en búsqueda de pistas:', errorText);
            throw new Error(`Error al buscar pistas: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[API Cliente] Error en searchTracks:', error);
        throw error;
    }
};
