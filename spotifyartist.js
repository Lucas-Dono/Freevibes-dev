const axios = require('axios');
const { Buffer } = require('buffer');

// Configura tus credenciales desde el Dashboard de Spotify
const CLIENT_ID = '6778e7ba2e214c40a04f76807e8d63cc';
const CLIENT_SECRET = '1e32f0928e7c492785d096beb7e0f9bc';

// Función para obtener el token de acceso
async function getAccessToken() {
    const authString = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    return response.data.access_token;
}

// Buscar el ID de un artista
async function getArtistId(artistName, accessToken) {
    const response = await axios.get('https://api.spotify.com/v1/search', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: {
            q: artistName,
            type: 'artist',
            limit: 1
        }
    });

    return response.data.artists.items[0].id;
}

// Obtener todos los álbumes del artista
async function getArtistAlbums(artistId, accessToken) {
    let allAlbums = [];
    let url = `https://api.spotify.com/v1/artists/${artistId}/albums`;

    do {
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: {
                limit: 50,
                include_groups: 'album,single,compilation'
            }
        });

        allAlbums = allAlbums.concat(response.data.items);
        url = response.data.next;

    } while (url);

    return allAlbums;
}

// Obtener todas las canciones de los álbumes
async function getAllTracks(albums, accessToken) {
    const seenTracks = new Set();
    const allTracks = [];

    for (const album of albums) {
        const response = await axios.get(
            `https://api.spotify.com/v1/albums/${album.id}/tracks`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        for (const track of response.data.items) {
            if (!seenTracks.has(track.id)) {
                seenTracks.add(track.id);
                allTracks.push({
                    name: track.name,
                    album: album.name
                });
            }
        }
    }

    return allTracks;
}

// Función principal
async function main() {
    try {
        const artistName = process.argv[2];
        if (!artistName) {
            console.log('Uso: node spotify.js "Nombre del Artista"');
            return;
        }

        const accessToken = await getAccessToken();
        const artistId = await getArtistId(artistName, accessToken);
        const albums = await getArtistAlbums(artistId, accessToken);
        const tracks = await getAllTracks(albums, accessToken);

        console.log(`\nTotal de canciones para ${artistName}: ${tracks.length}`);
        console.log('\nCanciones:');
        tracks.forEach((track, index) => {
            console.log(`${index + 1}. ${track.name} (Álbum: ${track.album})`);
        });

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

main();
