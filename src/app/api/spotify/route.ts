import { NextRequest, NextResponse } from 'next/server';
import { getSpotify } from '@/lib/spotify';
import { getRecommendationsByGenre } from '@/services/recommendations';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Marcar esta ruta explícitamente como dinámica para evitar errores de compilación estática
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const action = searchParams.get('action');
		
		if (!action) {
			return Response.json({ error: 'Acción requerida' }, { status: 400 });
		}

		// Verificar si el usuario está autenticado usando NextAuth
		const session = await getServerSession(authOptions);

		// Verificar si estamos en modo demo desde las cookies o los headers
		const demoModeCookie = request.cookies.get('demo-mode')?.value === 'true' || request.cookies.get('demoMode')?.value === 'true';
		const demoModeHeader = request.headers.get('x-demo-mode') === 'true';
		const isDemoMode = demoModeCookie || demoModeHeader;
		
		// Mostrar información de depuración
		console.log(`[API] Estado de autenticación: session=${!!session}, demo-mode=${isDemoMode}`);
		
		// Verificar si el usuario está autenticado O estamos en modo demo
		if ((!session || !session.accessToken) && !isDemoMode) {
			console.log('[API] Usuario no autenticado, redirigiendo a login');
			return Response.json({ 
				error: 'No autenticado',
				message: 'Se requiere autenticación con Spotify',
				redirect: '/login'
			}, { status: 401 });
		}
		
		// Si estamos en modo demo, usar un token ficticio o redireccionar a la API Node
		if (isDemoMode) {
			console.log('[API] Solicitud en modo demo, utilizando datos demo');
			
			// Redireccionar al servidor Node que maneja el modo demo
			try {
				// Construir la URL para el servidor Node con el header de modo demo
				const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
				const nodeServerPort = 3001;
				const nodeServerHost = 'localhost'; // Cambiar según entorno
				
				// Crear URL con todos los parámetros originales
				const params = new URLSearchParams();
				// Usar Array.from para iterar correctamente
				Array.from(request.nextUrl.searchParams.entries()).forEach(([key, value]) => {
					params.append(key, value);
				});
				
				const nodeUrl = `${protocol}://${nodeServerHost}:${nodeServerPort}/api/spotify?${params.toString()}`;
				
				console.log(`[API] Redireccionando solicitud demo a: ${nodeUrl}`);
				
				// Realizar solicitud al servidor Node con headers de modo demo
				const response = await fetch(nodeUrl, {
					headers: {
						'x-demo-mode': 'true',
						'x-demo-lang': 'es' // Puedes hacer esto configurable
					}
				});
				
				if (!response.ok) {
					throw new Error(`Error en servidor Node: ${response.status}`);
				}
				
				const demoData = await response.json();
				return Response.json(demoData);
			} catch (error: any) { // Tipamos error como any para acceder a message
				console.error('[API] Error al obtener datos demo:', error);
				// Devolver respuesta genérica en caso de error
				return Response.json({ 
					error: 'Error en modo demo',
					message: error.message || 'No se pudieron obtener datos demo'
				}, { status: 500 });
			}
		}

		let data: any;
		console.log(`[API] Procesando acción: ${action}`);

		try {
			// Verificar que session no es null y tiene accessToken
			if (!session || !session.accessToken) {
				throw new Error('No se encontró un token de acceso válido');
			}
			
			// Usar el token de acceso de la sesión para las solicitudes a Spotify
			const accessToken: string = session.accessToken;

			// Declaramos data con un valor predeterminado para casos de fallback
			data = { fallback: true };

			switch (action) {
				case 'featured':
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const locale = searchParams.get('locale') || 'es_ES';
					
					console.log(`[API] Obteniendo playlists destacadas (limit=${limit}, offset=${offset}, locale=${locale})`);
					try {
						data = await fetchFromSpotify('/browse/featured-playlists', {
								limit: limit > 50 ? 50 : limit,
								offset,
								locale
						}, accessToken!);
						console.log('[API] Playlists destacadas obtenidas:', data.playlists?.items?.length || 0);
					} catch (error: any) {
						// Si hay un error 404 con las playlists, obtener álbumes como alternativa
						if (error.message && error.message.includes('404')) {
							console.log('[API] Error 404 al obtener playlists destacadas. Usando álbumes como alternativa...');
							
							try {
								// Obtener nuevos lanzamientos (álbumes) como alternativa
								const albumsData = await fetchFromSpotify('/browse/new-releases', {
									limit: limit > 50 ? 50 : limit,
									offset,
									country: 'ES'  // Se puede adaptar según la localización
								}, accessToken!);
								
								// Transformar el formato de respuesta para que coincida con el de playlists
								data = {
									message: 'Álbumes obtenidos como alternativa a playlists',
									playlists: {
										href: albumsData.albums.href,
										items: albumsData.albums.items.map((album: any) => ({
											id: album.id,
											name: album.name,
											description: `Álbum de ${album.artists.map((a: any) => a.name).join(', ')}`,
											images: album.images,
											owner: { display_name: album.artists[0]?.name || 'Artista' },
											tracks: { total: album.total_tracks || 0 },
											type: 'album',  // Mantener el tipo real para el manejo interno
											album_type: album.album_type,
											album: true     // Indicador para el frontend de que es un álbum
										})),
										limit: albumsData.albums.limit,
										next: albumsData.albums.next,
										offset: albumsData.albums.offset,
										previous: albumsData.albums.previous,
										total: albumsData.albums.total
									}
								};
								
								console.log('[API] Álbumes obtenidos como alternativa:', data.playlists?.items?.length || 0);
							} catch (albumError) {
								console.error('[API] Error al obtener álbumes como alternativa:', albumError);
								throw error; // Mantener el error original si también fallan los álbumes
							}
						} else {
							// Si no es un error 404, propagarlo
							throw error;
						}
					}
				break;

				case 'new-releases':
					const limitReleases = parseInt(searchParams.get('limit') || '20');
					const country = searchParams.get('country') || 'US';
					console.log(`[API] Obteniendo nuevos lanzamientos (limit=${limitReleases}, country=${country})`);
					data = await fetchFromSpotify('/browse/new-releases', {
						limit: limitReleases,
						country
					}, accessToken!);
					console.log(`[API] Nuevos lanzamientos obtenidos: ${data.albums?.items?.length || 0}`);
				break;

				case 'top':
					const limitTop = parseInt(searchParams.get('limit') || '6');
					const timeRange = searchParams.get('time_range') || 'medium_term';
					console.log(`[API] Obteniendo top tracks (limit=${limitTop}, time_range=${timeRange})`);
					data = await fetchFromSpotify('/me/top/tracks', {
						limit: limitTop,
						time_range: timeRange
					}, accessToken!);
					console.log(`[API] Top tracks obtenidos: ${data.items?.length || 0}`);
				break;

				case 'saved-tracks':
					const limitSaved = parseInt(searchParams.get('limit') || '6');
					const offsetSaved = parseInt(searchParams.get('offset') || '0');
					console.log(`[API] Obteniendo tracks guardados (limit=${limitSaved}, offset=${offsetSaved})`);
					data = await fetchFromSpotify('/me/tracks', {
						limit: limitSaved,
						offset: offsetSaved
					}, accessToken!);
					console.log(`[API] Tracks guardados obtenidos: ${data.items?.length || 0}`);
				break;

				case 'recommendations':
					try {
						const limitRecs = parseInt(searchParams.get('limit') || '6');
						// Obtener y procesar seed_tracks
						const seedTracks = searchParams.get('seed_tracks');
						const seedGenres = searchParams.get('seed_genres');
						
						let params: Record<string, any> = {
							limit: limitRecs,
							market: 'ES'
						};
						
						// Añadir logs detallados para diagnosticar el problema
						console.log('[API-SPOTIFY] Iniciando solicitud de recomendaciones');
						console.log('[API-SPOTIFY] Token disponible:', !!accessToken);
						
						// Procesar seed_tracks para remover el prefijo spotify:track: si existe
						if (seedTracks) {
							// Para diagnóstico, ver el formato exacto que recibimos
							console.log('[API-SPOTIFY] seed_tracks original:', seedTracks);
							
							// Eliminar prefijo si existe
							params.seed_tracks = seedTracks.split(',')
								.map(track => {
									const cleaned = track.replace('spotify:track:', '');
									console.log(`[API-SPOTIFY] Procesando track: ${track} -> ${cleaned}`);
									return cleaned;
								})
								.join(',');
							
							console.log('[API-SPOTIFY] Usando seed_tracks procesados:', params.seed_tracks);
						} else if (seedGenres) {
							params.seed_genres = seedGenres;
							console.log('[API-SPOTIFY] Usando seed_genres:', params.seed_genres);
						} else {
							// Si no hay seeds, intentar obtener top tracks del usuario
							try {
								console.log('[API-SPOTIFY] No hay seeds, buscando top tracks del usuario');
								const topTracksResponse = await fetchFromSpotify('/me/top/tracks', { 
									limit: 5,
									time_range: 'short_term' 
								}, accessToken!);
								
								if (topTracksResponse.items && topTracksResponse.items.length > 0) {
									const trackIds = topTracksResponse.items
										.slice(0, 5)
										.map((track: any) => track.id)
										.join(',');
									params.seed_tracks = trackIds;
									console.log('[API-SPOTIFY] Usando top tracks como seeds:', params.seed_tracks);
								} else {
									params.seed_genres = 'pop,rock,hip-hop,electronic,latin';
									console.log('[API-SPOTIFY] No hay top tracks, usando géneros por defecto');
								}
							} catch (topTracksError) {
								console.error('[API-SPOTIFY] Error obteniendo top tracks:', topTracksError);
								params.seed_genres = 'pop,rock,hip-hop,electronic,latin';
								console.log('[API-SPOTIFY] Error en top tracks, usando géneros por defecto');
							}
						}
						
						// Construir la URL completa para depuración
						const apiUrl = `https://api.spotify.com/v1/recommendations?${new URLSearchParams(params).toString()}`;
						console.log('[API-SPOTIFY] URL completa:', apiUrl);
						
						try {
							// Intentar obtener recomendaciones de Spotify
							data = await fetchFromSpotify('/recommendations', params, accessToken!);
							
							// Registrar la respuesta completa para depuración
							console.log('[API-SPOTIFY] Respuesta completa recibida:', 
								data ? 'Datos válidos' : 'Sin datos',
								data?.tracks ? `${data.tracks.length} tracks` : 'Sin tracks'
							);
						
							if (!data.tracks || data.tracks.length === 0) {
								throw new Error('No se encontraron recomendaciones en la respuesta');
							}
							
							console.log(`[API-SPOTIFY] Recomendaciones obtenidas: ${data.tracks.length}`);
						} catch (fetchError) {
							console.error('[API-SPOTIFY] Error al hacer fetch de recomendaciones:', fetchError);
							
							// Usar YouTube Music como fallback en caso de error
							console.log('[API-SPOTIFY] Usando fallback de YouTube Music para recomendaciones');
							try {
								// Extraer información del seed_track si está disponible
								let artistName = searchParams.get('artist_name') || '';
								let trackName = searchParams.get('track_name') || '';
								const limit = searchParams.get('limit') || '25';
								
								// Si tenemos un track de Spotify, intentar extraer su nombre y artista
								if (seedTracks) {
									const trackId = seedTracks.replace('spotify:track:', '');
									try {
										// Intentar obtener información del track para usarla en la búsqueda de YouTube
										const trackInfo = await fetchFromSpotify(`/tracks/${trackId}`, {}, accessToken!);
										if (trackInfo?.name) {
											trackName = trackInfo.name;
											if (trackInfo.artists && trackInfo.artists.length > 0) {
												artistName = trackInfo.artists[0].name;
											}
										}
									} catch (trackError) {
										console.error('[API-SPOTIFY] Error al obtener info del track:', trackError);
									}
								}
								
								// Construir los parámetros para la solicitud a YouTube Music
								const youtubeParams = new URLSearchParams();
								if (artistName) youtubeParams.append('seed_artist', artistName);
								if (trackName) youtubeParams.append('seed_track', trackName);
								youtubeParams.append('limit', limit);
								
								// Determinar la URL base del servidor
								const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
								// Importante: Usar directamente el puerto 3001 donde corre el servidor Node
								// en lugar de pasar por Next.js (puerto 3000) que tiene middleware de autenticación
								const nodeServerPort = 3001;
								const nodeServerHost = 'localhost'; // En producción, usar la URL adecuada
								
								// Construir la URL absoluta correctamente, apuntando directamente al servidor Node
								const youtubeRecsUrl = `${protocol}://${nodeServerHost}:${nodeServerPort}/api/youtube/recommendations`;
								const urlWithParams = youtubeParams.toString() 
									? `${youtubeRecsUrl}?${youtubeParams.toString()}`
									: youtubeRecsUrl;
								
								console.log('[API-SPOTIFY] Fallback: URL directa al servidor Node:', urlWithParams);
								
								// Realizar la solicitud a YouTube Music
								const ytResponse = await fetch(urlWithParams, {
									headers: { 'Content-Type': 'application/json' }
								});
								
								if (ytResponse.ok) {
									// Obtener el texto de la respuesta primero para verificar si es HTML o JSON
									const responseText = await ytResponse.text();
									
									// Verificar si la respuesta parece ser HTML (comienza con <!DOCTYPE o <html)
									if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
										console.error('[API-SPOTIFY] YouTube Music devolvió HTML en lugar de JSON');
										console.error('[API-SPOTIFY] Primeros 100 caracteres:', responseText.substring(0, 100));
										throw new Error('YouTube Music devolvió HTML en lugar de JSON');
									}
									
									try {
										// Intentar parsear la respuesta como JSON
										const ytData = JSON.parse(responseText);
										console.log('[API-SPOTIFY] Resultados de YouTube Music:', Array.isArray(ytData) ? ytData.length : 'No es array');
										
										return Response.json({
											tracks: Array.isArray(ytData) ? ytData : getFallbackRecommendations(parseInt(limit))
										});
									} catch (parseError: any) {
										console.error('[API-SPOTIFY] Error al parsear respuesta de YouTube Music:', parseError);
										console.error('[API-SPOTIFY] Primeros 100 caracteres de la respuesta:', responseText.substring(0, 100));
										throw new Error(`Error al parsear respuesta de YouTube Music: ${parseError.message}`);
									}
								} else {
									const errorText = await ytResponse.text();
									console.error(`[API-SPOTIFY] Error en YouTube Music (${ytResponse.status}):`, 
										errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText);
									throw new Error(`Error en YouTube Music: ${ytResponse.status}`);
								}
							} catch (fallbackError) {
								console.error('[API-SPOTIFY] Error en fallback de YouTube Music:', fallbackError);
								throw fallbackError; // Propagar el error para manejarlo en el nivel superior
							}
						}
					} catch (recommendationsError) {
						console.error('[API-SPOTIFY] Error en recomendaciones:', recommendationsError);
						
						// Información más detallada para diagnóstico
						let errorMessage = 'Error desconocido al obtener recomendaciones';
						let errorCode = 500;
						
						if (recommendationsError instanceof Error) {
							errorMessage = recommendationsError.message;
							
							// Intentar extraer código de error si existe
							if ('status' in recommendationsError) {
								errorCode = (recommendationsError as any).status;
							}
						}
						
						return Response.json({ 
							error: 'Error al obtener recomendaciones',
							message: errorMessage,
							fallback: true,
							tracks: getFallbackRecommendations(parseInt(searchParams.get('limit') || '6'))
						}, { status: errorCode });
					}
				break;

				case 'categories':
					const limitCat = parseInt(searchParams.get('limit') || '50');
					const offsetCat = parseInt(searchParams.get('offset') || '0');
					const countryCat = searchParams.get('country') || 'ES';
					const localeCat = searchParams.get('locale') || 'es_ES';
					
					console.log(`[API] Obteniendo categorías (limit=${limitCat}, offset=${offsetCat})`);
					data = await fetchFromSpotify('/browse/categories', {
						limit: limitCat,
						offset: offsetCat,
						country: countryCat,
						locale: localeCat
					}, accessToken!);
					console.log(`[API] Categorías obtenidas: ${data.categories?.items?.length || 0}`);
				break;

				case 'category-playlists':
					const categoryId = searchParams.get('categoryId');
					const limitCatPlaylists = parseInt(searchParams.get('limit') || '20');
					const offsetCatPlaylists = parseInt(searchParams.get('offset') || '0');
					const countryCatPlaylists = searchParams.get('country') || 'ES';
					
					if (!categoryId) {
						return Response.json({ error: 'Se requiere categoryId' }, { status: 400 });
					}
					
					console.log(`[API] Obteniendo playlists de categoría ${categoryId}`);
					data = await fetchFromSpotify(`/browse/categories/${categoryId}/playlists`, {
						limit: limitCatPlaylists,
						offset: offsetCatPlaylists,
						country: countryCatPlaylists
					}, accessToken!);
					console.log(`[API] Playlists de categoría obtenidas: ${data.playlists?.items?.length || 0}`);
				break;

				case 'search':
					const query = searchParams.get('query');
					const limitSearch = parseInt(searchParams.get('limit') || '20');
					const offsetSearch = parseInt(searchParams.get('offset') || '0');
					const typeSearch = searchParams.get('type') || 'track';
					const marketSearch = searchParams.get('market') || 'ES';
					
					if (!query) {
						return Response.json({ error: 'Se requiere query para búsqueda' }, { status: 400 });
					}
					
					console.log(`[API] Realizando búsqueda por "${query}"`);
					data = await fetchFromSpotify('/search', {
						q: query,
						type: typeSearch,
						limit: limitSearch,
						offset: offsetSearch,
						market: marketSearch
					}, accessToken!);
					console.log(`[API] Resultados de búsqueda obtenidos`);
				break;

				case 'search-artists':
					const artistQuery = searchParams.get('query');
					const limitArtists = parseInt(searchParams.get('limit') || '20');
					const offsetArtists = parseInt(searchParams.get('offset') || '0');
					const marketArtists = searchParams.get('market') || 'ES';
					
					if (!artistQuery) {
						return Response.json({ error: 'Se requiere query para búsqueda de artistas' }, { status: 400 });
					}
					
					console.log(`[API] Realizando búsqueda de artistas por "${artistQuery}"`);
					const artistSearchResponse = await fetchFromSpotify('/search', {
						q: artistQuery,
						type: 'artist',
						limit: limitArtists,
						offset: offsetArtists,
						market: marketArtists
					}, accessToken!);
					
					// Devolver solo los artistas
					data = { items: artistSearchResponse.artists?.items || [] };
					console.log(`[API] Artistas encontrados: ${data.items.length}`);
				break;
				
			case 'available-genres':
					console.log('[API] Obteniendo géneros disponibles');
					data = await fetchFromSpotify('/recommendations/available-genre-seeds', {}, accessToken!);
					console.log(`[API] Géneros disponibles obtenidos: ${data.genres?.length || 0}`);
				break;

				case 'direct':
					const endpoint = searchParams.get('endpoint');
					
					if (!endpoint) {
						return Response.json({ error: 'Se requiere endpoint para llamada directa' }, { status: 400 });
					}
					
					// Decodificar el endpoint para obtener la ruta base y los parámetros
					const decodedEndpoint = decodeURIComponent(endpoint);
					const endpointUrl = new URL(`https://api.spotify.com/v1${decodedEndpoint}`);
					const endpointParams: Record<string, any> = {};
					
					// Extraer los parámetros de consulta del endpoint
					endpointUrl.searchParams.forEach((value, key) => {
						endpointParams[key] = value;
					});
					
					// Obtener la ruta base sin los parámetros
					const basePath = endpointUrl.pathname.replace('/v1', '');
					
					console.log(`[API] Llamada directa a Spotify: ${basePath}`);
					data = await fetchFromSpotify(basePath, endpointParams, accessToken!);
					console.log('[API] Llamada directa a Spotify completada');
				break;
				
				case 'genre-recommendations':
					const genre = searchParams.get('genre');
					const limitGenreRecs = parseInt(searchParams.get('limit') || '20');
					const marketGenreRecs = searchParams.get('market') || 'ES';
					
					if (!genre) {
						return Response.json({ error: 'Se requiere género para recomendaciones' }, { status: 400 });
					}
					
					console.log(`[API] Obteniendo recomendaciones para género ${genre}`);
					data = await fetchFromSpotify('/recommendations', {
						seed_genres: genre,
						limit: limitGenreRecs,
						market: marketGenreRecs
					}, accessToken!);
					console.log(`[API] Recomendaciones por género obtenidas: ${data.tracks?.length || 0}`);
				break;

				default:
					return Response.json({ error: 'Acción no soportada' }, { status: 400 });
			}

			return Response.json(data);
		} catch (error) {
			console.error(`[API] Error procesando acción ${action}:`, error);
			
			// Si el error es de autenticación, redireccionar a login
			if (error instanceof Error && 
				(error.message.includes('401') || 
				error.message.includes('No autenticado'))) {
				
				return Response.json({ 
					error: 'No autenticado',
					message: 'Se requiere autenticación con Spotify',
					redirect: '/login'
				}, { status: 401 });
			}
			
			// Si es un error 404, intentar generar datos fallback según la acción
			if (error instanceof Error && error.message.includes('404')) {
				// Generar datos fallback según el tipo de acción
				if (action === 'recommendations') {
					const limitRecs = parseInt(searchParams.get('limit') || '6');
									data = {
						tracks: getFallbackRecommendations(limitRecs)
					};
					console.log('[API] Usando recomendaciones fallback por error 404');
					return Response.json(data);
				}
				// Añadir más casos de fallback para otras acciones si es necesario
			}
			
			// Otros errores
			return Response.json({ 
				error: 'Error en la API de Spotify',
				details: error instanceof Error ? error.message : 'Error desconocido'
			}, { status: 500 });
		}
	} catch (error) {
		console.error('[API] Error general en la API de Spotify:', error);
		return Response.json({ 
			error: 'Error inesperado',
			details: error instanceof Error ? error.message : 'Error desconocido'
		}, { status: 500 });
	}
}

// Función auxiliar para hacer solicitudes a la API de Spotify
async function fetchFromSpotify(endpoint: string, params: Record<string, any>, accessToken: string) {
	const url = new URL(`https://api.spotify.com/v1${endpoint}`);
	
	// Añadir parámetros a la URL
	Object.entries(params).forEach(([key, value]) => {
		url.searchParams.append(key, value.toString());
	});
	
	console.log(`[API Spotify] Solicitando: ${url.toString()}`);
	
	// Realizar la solicitud con el token de acceso
	try {
		const response = await fetch(url.toString(), {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Content-Type': 'application/json'
			}
		});
		
		if (!response.ok) {
			try {
				const errorData = await response.json().catch(() => ({}));
				console.error(`[API Spotify] Error ${response.status} en solicitud a ${endpoint}:`, errorData);
				
				// Manejo específico de errores
				if (response.status === 404) {
					// Para errores 404, proporcionar un mensaje más detallado
					const errorMessage = errorData.error?.message || `Recurso no encontrado: ${endpoint}`;
					throw new Error(`Error 404: ${errorMessage}`);
				} else if (response.status === 401) {
					// Para errores de autorización
					throw new Error(`Error de autorización: Es posible que la sesión haya expirado. Por favor, inicia sesión nuevamente.`);
				} else {
					// Para otros errores
					throw new Error(`Error ${response.status}: ${errorData.error?.message || 'Error desconocido'}`);
				}
			} catch (parseError) {
				// Si hay un error al parsear la respuesta de error
				if (response.status === 404) {
					throw new Error(`Error 404: Recurso no encontrado - ${endpoint}`);
				} else if (response.status === 401) {
					throw new Error(`Error 401: No autorizado - La sesión puede haber expirado`);
				} else {
					throw new Error(`Error ${response.status}: No se pudo procesar la respuesta`);
				}
			}
		}
		
		return response.json();
	} catch (error) {
		// Capturar errores de red o timeouts
		if (error instanceof Error) {
			console.error(`[API Spotify] Error en solicitud a ${endpoint}:`, error.message);
			throw error;
		} else {
			console.error(`[API Spotify] Error desconocido en solicitud a ${endpoint}`);
			throw new Error(`Error desconocido al acceder a la API de Spotify`);
		}
	}
}

// Función auxiliar para generar recomendaciones fallback cuando la API falla
function getFallbackRecommendations(limit: number = 6) {
	const fallbackTracks = [];
	
	// Datos de muestra para cuando la API falla
	const sampleCovers = [
		'https://i.scdn.co/image/ab67616d0000b2737b9e5a9d697bcb8bf86a83b4',
		'https://i.scdn.co/image/ab67616d0000b273450a500a9eef89fbac8a85ff',
		'https://i.scdn.co/image/ab67616d0000b273e8107e6d9214baa81bb79bba',
		'https://i.scdn.co/image/ab67616d0000b273814456ecfe8f73373a8b147c',
		'https://i.scdn.co/image/ab67616d0000b2731f4752e83c0cf31fb4e10a12',
		'https://i.scdn.co/image/ab67616d0000b273419950fdf75f95ae50936b0a'
	];
	
	for (let i = 0; i < limit; i++) {
		const coverIndex = i % sampleCovers.length;
		
		fallbackTracks.push({
			id: `fallback_${i}`,
			name: `Recomendación #${i + 1}`,
			artists: [{ name: 'Artista' }],
			album: {
				name: 'Álbum',
				images: [{ url: sampleCovers[coverIndex] }]
			},
			duration_ms: 180000 + (i * 10000),
			popularity: 75
		});
	}
	
	return fallbackTracks;
} 