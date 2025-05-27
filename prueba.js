const fetch = require('node-fetch');
const readline = require('readline-sync');

// Función para obtener el token de acceso
async function getAccessToken(clientId, clientSecret) {
    const authHeader = 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64');

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) throw new Error('Error en la autenticación');

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Error obteniendo token:', error);
        return null;
    }
}

// Función para buscar un artista
async function searchArtist(accessToken, artistName) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) throw new Error('Error en la búsqueda');

        const data = await response.json();
        return data.artists.items[0]?.id;
    } catch (error) {
        console.error('Error buscando artista:', error);
        return null;
    }
}

// Función para obtener artistas relacionados
async function getRelatedArtists(accessToken, artistId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) throw new Error('Error obteniendo artistas relacionados');

        const data = await response.json();
        return data.artists;
    } catch (error) {
        console.error('Error obteniendo relacionados:', error);
        return null;
    }
}

// Función principal
async function main() {
    // Solicitar credenciales
    const clientId = readline.question('Ingresa tu Client ID de Spotify: ');
    const clientSecret = readline.question('Ingresa tu Client Secret de Spotify: ', {
        hideEchoBack: true // Para ocultar la entrada del secret
    });

    // Obtener token
    const accessToken = await getAccessToken(clientId, clientSecret);
    if (!accessToken) return;

    // Solicitar artista
    const artistName = readline.question('\nIngresa el nombre del artista: ');
    const artistId = await searchArtist(accessToken, artistName);

    if (!artistId) {
        console.log('Artista no encontrado');
        return;
    }

    // Obtener relacionados
    const relatedArtists = await getRelatedArtists(accessToken, artistId);

    if (!relatedArtists || relatedArtists.length === 0) {
        console.log('No se encontraron artistas relacionados');
        return;
    }

    // Mostrar resultados
    console.log('\nArtistas relacionados:');
    relatedArtists.forEach((artist, index) => {
        console.log(`${index + 1}. ${artist.name}`);
        console.log(`   Géneros: ${artist.genres.join(', ') || 'N/A'}`);
        console.log(`   Popularidad: ${artist.popularity}`);
        console.log(`   Seguidores: ${artist.followers.total}\n`);
    });
}

// Ejecutar el programa
main().catch(error => console.error('Error:', error.message));
