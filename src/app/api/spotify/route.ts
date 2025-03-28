import { NextRequest, NextResponse } from 'next/server';
import { getSpotify } from '@/lib/spotify';
import { getRecommendationsByGenre } from '@/services/recommendations';

// Marcar esta ruta explícitamente como dinámica para evitar errores de compilación estática
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
	try {
		const sp = await getSpotify();
		const { searchParams } = new URL(request.url);

		const action = searchParams.get('action');
		if (!action) {
			return new Response(JSON.stringify({ error: 'Acción requerida' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		let data: any = null;

		switch (action) {
			case 'featured':
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const locale = searchParams.get('locale') || 'es_ES';
					
					console.log(`API: Intentando obtener playlists destacadas (limit=${limit}, offset=${offset}, locale=${locale})`);
					
					try {
						data = await sp.getFeaturedPlaylists({ 
							limit: limit > 50 ? 50 : limit,
							offset,
							locale
						});
						console.log('API: Playlists destacadas obtenidas correctamente:', data.playlists?.items?.length || 0);
					} catch (featuredError) {
						console.error('API: Error en endpoint de playlists destacadas:', featuredError);
						
						// Plan B: Si hay error en playlists destacadas, intentar con playlists del usuario
						console.log('API: Intentando fallback con playlists del usuario');
						try {
							const userPlaylists = await sp.getUserPlaylists({ limit: limit > 50 ? 50 : limit });
							
							// Transformar formato para que coincida con featured playlists
							data = {
								message: "Playlists alternativas",
								playlists: {
									href: userPlaylists.href,
									items: userPlaylists.items || [],
									limit: userPlaylists.limit,
									next: userPlaylists.next,
									offset: userPlaylists.offset,
									previous: userPlaylists.previous,
									total: userPlaylists.total
								}
							};
							console.log('API: Usando playlists del usuario como alternativa:', data.playlists?.items?.length || 0);
						} catch (userPlaylistsError) {
							console.error('API: También falló el fallback de playlists del usuario:', userPlaylistsError);
							
							// Plan C: Si todo falla, devolver datos mockeados
							console.log('API: Devolviendo datos mockeados para playlists destacadas');
							data = {
								message: "Playlists recomendadas (fallback)",
								playlists: {
									href: "https://api.spotify.com/v1/browse/featured-playlists",
									items: [
										{
											collaborative: false,
											description: "Playlist recomendada (API fallback)",
											id: "fallback_playlist_1",
											images: [{ url: "https://placehold.co/600x600/orange/white?text=Musica+Popular", height: 600, width: 600 }],
											name: "Música Popular",
											owner: { display_name: "Spotify" },
											public: true,
											tracks: { total: 50 }
										},
										{
											collaborative: false,
											description: "Lo mejor de la música latina (API fallback)",
											id: "fallback_playlist_2",
											images: [{ url: "https://placehold.co/600x600/green/white?text=Exitos+Latinos", height: 600, width: 600 }],
											name: "Éxitos Latinos",
											owner: { display_name: "Spotify" },
											public: true,
											tracks: { total: 50 }
										},
										{
											collaborative: false,
											description: "Rock clásico y contemporáneo (API fallback)",
											id: "fallback_playlist_3",
											images: [{ url: "https://placehold.co/600x600/red/white?text=Rock+Classics", height: 600, width: 600 }],
											name: "Rock Classics",
											owner: { display_name: "Spotify" },
											public: true,
											tracks: { total: 50 }
										}
									],
									limit: limit,
									next: null,
									offset: offset,
									previous: null,
									total: 3
								}
							};
						}
					}
				} catch (error) {
					console.error('Error al obtener playlists destacadas:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener playlists destacadas',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;
				
			case 'new-releases':
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const market = searchParams.get('market') || 'ES';
					
					console.log(`API: Intentando obtener nuevos lanzamientos (limit=${limit}, offset=${offset}, market=${market})`);
					
					try {
						data = await sp.getNewReleases({ 
							limit: limit > 50 ? 50 : limit,
							offset,
							market 
						});
						console.log('API: Nuevos lanzamientos obtenidos correctamente:', data.albums?.items?.length || 0);
					} catch (releasesError) {
						console.error('API: Error en endpoint de nuevos lanzamientos:', releasesError);
						
						// Datos mockeados en caso de fallo
						console.log('API: Devolviendo datos mockeados para nuevos lanzamientos');
						data = {
							albums: {
								href: "https://api.spotify.com/v1/browse/new-releases",
								items: [
									{
										id: "fallback_album_1",
										name: "Álbum Popular (Fallback)",
										artists: [{ name: "Artista Popular" }],
										images: [{ url: "https://placehold.co/600x600/blue/white?text=Album+Popular", height: 600, width: 600 }]
									},
									{
										id: "fallback_album_2",
										name: "Éxitos del Momento (Fallback)",
										artists: [{ name: "Artista Trending" }],
										images: [{ url: "https://placehold.co/600x600/purple/white?text=Exitos+Momento", height: 600, width: 600 }]
									}
								],
								limit: limit,
								next: null,
								offset: offset,
								previous: null,
								total: 2
							}
						};
					}
				} catch (error) {
					console.error('Error al obtener nuevos lanzamientos:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener nuevos lanzamientos',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'search':
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const q = searchParams.get('q') || searchParams.get('query');
					const type = searchParams.get('type') || 'track,artist,album,playlist';
					const market = searchParams.get('market') || 'ES';
					
					if (!q) {
						return new Response(JSON.stringify({ error: 'Consulta de búsqueda requerida' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}
					
					console.log(`API: Buscando "${q}" (type=${type}, limit=${limit}, offset=${offset})`);
					
					// Implementar búsqueda múltiple basada en los tipos solicitados
					const types = type.split(',');
					const searchResults: any = {};

					if (types.includes('track')) {
						console.log(`API: Buscando pistas con query="${q}"`);
						const trackResults = await sp.searchTracks(q, {
							limit: limit > 50 ? 50 : limit,
							offset,
							market
						});
						searchResults.tracks = trackResults.tracks;
					}

					if (types.includes('artist')) {
						console.log(`API: Buscando artistas con query="${q}"`);
						const artistResults = await sp.searchArtists(q, {
							limit: limit > 50 ? 50 : limit,
							offset,
							market
						});
						searchResults.artists = artistResults.artists;
					}

					if (types.includes('playlist')) {
						console.log(`API: Buscando playlists con query="${q}"`);
						const playlistResults = await sp.searchPlaylists(q, {
							limit: limit > 50 ? 50 : limit,
							offset,
							market
						});
						searchResults.playlists = playlistResults.playlists;
					}

					// Devolver los resultados combinados
					data = searchResults;
					
					console.log(`API: Búsqueda completada para "${q}"`);
				} catch (error) {
					console.error('Error en búsqueda:', error);
					return new Response(JSON.stringify({ 
						error: 'Error en búsqueda',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'direct':
				try {
					const endpoint = searchParams.get('endpoint');
					if (!endpoint) {
						return new Response(JSON.stringify({ error: 'Missing endpoint parameter' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}

					// Construir el endpoint completo con todos los parámetros
					let fullEndpoint = endpoint;
					
					// Verificar si ya hay parámetros en el endpoint
					const hasQueryParams = endpoint.includes('?');
					let firstParam = !hasQueryParams;
					
					// Si es una búsqueda, asegurarse de que tenga el parámetro type
					let hasMissingTypeParam = false;
					if (endpoint.includes('/search') && !endpoint.includes('type=') && !searchParams.has('type')) {
						// Si no hay type en el endpoint ni en los parámetros, añadir un valor por defecto
						console.log('Parámetro type no encontrado, añadiendo valor por defecto');
						const separator = firstParam ? '?' : '&';
						fullEndpoint += `${separator}type=track,artist`;
						firstParam = false;
						hasMissingTypeParam = false; // Ya no falta porque lo hemos añadido
					}
					
					// Añadir todos los demás parámetros de la URL
					searchParams.forEach((value, key) => {
						if (key !== 'action' && key !== 'endpoint') {
							// Agregar el separador correcto de parámetros (? o &)
							const separator = firstParam ? '?' : '&';
							fullEndpoint += `${separator}${key}=${encodeURIComponent(value)}`;
							firstParam = false;
						}
					});

					// Verificar si es una búsqueda y aún falta el parámetro type
					if (endpoint.includes('/search') && !fullEndpoint.includes('type=')) {
						console.error('Falta el parámetro type en búsqueda de Spotify');
						return new Response(JSON.stringify({ error: 'Missing parameter type for search' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}

					console.log(`API: Ejecutando solicitud directa a Spotify: ${fullEndpoint}`);
					
					// Usar el endpoint completo con todos los parámetros
					const result = await sp.makeRequest(fullEndpoint);
					
					return new Response(JSON.stringify(result));
				} catch (error) {
					console.error('Error en solicitud directa a Spotify:', error);
					return new Response(JSON.stringify({ error: 'Error en solicitud directa a Spotify' }), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'playlist':
				try {
					const id = searchParams.get('id');
					const market = searchParams.get('market') || 'ES';
					
					if (!id) {
						return new Response(JSON.stringify({ error: 'ID de playlist requerido' }), {
						status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}
					
					console.log(`API: Obteniendo detalles de playlist ${id}`);
					data = await sp.getPlaylist(id, { market });
					console.log(`API: Detalles de playlist ${id} obtenidos`);
				} catch (error) {
					console.error('Error al obtener detalles de playlist:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener detalles de playlist',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'playlist-tracks':
				try {
					const id = searchParams.get('id');
					const limit = parseInt(searchParams.get('limit') || '100');
					const offset = parseInt(searchParams.get('offset') || '0');
					const market = searchParams.get('market') || 'ES';
					
					if (!id) {
						return new Response(JSON.stringify({ error: 'ID de playlist requerido' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}
					
					console.log(`API: Obteniendo tracks de playlist ${id} (limit=${limit}, offset=${offset})`);
					data = await sp.getPlaylistTracks(id, { 
						limit: limit > 100 ? 100 : limit,
						offset,
						market
					});
					console.log(`API: Tracks de playlist ${id} obtenidos: ${data.items?.length || 0}`);
				} catch (error) {
					console.error('Error al obtener tracks de playlist:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener tracks de playlist',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'top':
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const time_range = searchParams.get('time_range') || 'medium_term'; // short_term, medium_term, long_term
					
					console.log(`API: Intentando obtener top tracks (limit=${limit}, offset=${offset}, time_range=${time_range})`);
					
					try {
						// Obtener las canciones más escuchadas del usuario
				data = await sp.getMyTopTracks({ 
							limit: limit > 50 ? 50 : limit,
							offset,
							time_range: time_range as 'short_term' | 'medium_term' | 'long_term'
						});
						
						console.log('API: Top tracks obtenidos correctamente:', data.items?.length || 0);
					} catch (topTracksError) {
						console.error('API: Error en endpoint de top tracks:', topTracksError);
						
						// Plan B: Intentar obtener recomendaciones personalizadas si fallan los top tracks
						console.log('API: Intentando fallback con recomendaciones');
						try {
							// Intentar obtener géneros semilla para recomendaciones
							const availableGenres = await sp.getAvailableGenreSeeds();
							const seedGenres = availableGenres.genres.slice(0, 5); // Usar hasta 5 géneros como semilla
							
							const recommendations = await sp.getRecommendations({
								seed_genres: seedGenres,
								limit: limit > 100 ? 100 : limit,
								market: 'ES'
							});
							
							// Transformar formato para que coincida con top tracks
							data = {
								href: "https://api.spotify.com/v1/me/top/tracks",
								items: recommendations.tracks || [],
								limit: recommendations.tracks.length,
								next: null,
								offset: 0,
								previous: null,
								total: recommendations.tracks.length
							};
							
							console.log('API: Usando recomendaciones como alternativa:', data.items?.length || 0);
						} catch (recommendationsError) {
							console.error('API: También falló el fallback de recomendaciones:', recommendationsError);
							
							// Plan C: Si todo falla, devolver datos mockeados
							console.log('API: Devolviendo datos mockeados para top tracks');
							data = {
								href: "https://api.spotify.com/v1/me/top/tracks",
								items: [
									{
										id: "fallback_track_1",
										name: "Canción Popular (Fallback)",
										artists: [{ name: "Artista Popular", id: "artist_1" }],
										album: {
											name: "Álbum Popular",
											id: "album_1",
											images: [{ url: "https://placehold.co/300x300/teal/white?text=Top+Track+1", height: 300, width: 300 }]
										},
										duration_ms: 180000,
										popularity: 95
									},
									{
										id: "fallback_track_2",
										name: "Éxito Reciente (Fallback)",
										artists: [{ name: "Artista Trending", id: "artist_2" }],
										album: {
											name: "Álbum de Moda",
											id: "album_2",
											images: [{ url: "https://placehold.co/300x300/navy/white?text=Top+Track+2", height: 300, width: 300 }]
										},
										duration_ms: 210000,
										popularity: 90
									},
									{
										id: "fallback_track_3",
										name: "Clásico Moderno (Fallback)",
										artists: [{ name: "Artista Veterano", id: "artist_3" }],
										album: {
											name: "Grandes Éxitos",
											id: "album_3",
											images: [{ url: "https://placehold.co/300x300/maroon/white?text=Top+Track+3", height: 300, width: 300 }]
										},
										duration_ms: 240000,
										popularity: 85
									}
								],
								limit: limit,
								next: null,
								offset: offset,
								previous: null,
								total: 3
							};
						}
					}
				} catch (error) {
					console.error('Error al obtener top tracks:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener top tracks',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;
				
			case 'top-artists':
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const timeRange = searchParams.get('timeRange') || 'medium_term'; // short_term, medium_term, long_term
					
					console.log(`API: Intentando obtener top artists (limit=${limit}, offset=${offset}, timeRange=${timeRange})`);
					
					try {
						// Obtener los artistas más escuchados del usuario
						data = await sp.getMyTopArtists({ 
							limit: limit > 50 ? 50 : limit,
							offset,
							time_range: timeRange as 'short_term' | 'medium_term' | 'long_term'
						});
						
						console.log('API: Top artists obtenidos correctamente:', data.items?.length || 0);
					} catch (topArtistsError) {
						console.error('API: Error en endpoint de top artists:', topArtistsError);
						
						// Datos mockeados en caso de fallo
						console.log('API: Devolviendo datos mockeados para top artists');
						data = {
							href: "https://api.spotify.com/v1/me/top/artists",
							items: [
								{
									id: "fallback_artist_1",
									name: "Artista Popular (Fallback)",
									genres: ["pop", "dance pop"],
									images: [{ url: "https://placehold.co/300x300/pink/black?text=Pop+Artist", height: 300, width: 300 }],
									popularity: 90
								},
								{
									id: "fallback_artist_2",
									name: "Rockstar (Fallback)",
									genres: ["rock", "alternative rock"],
									images: [{ url: "https://placehold.co/300x300/black/white?text=Rock+Star", height: 300, width: 300 }],
									popularity: 85
								},
								{
									id: "fallback_artist_3",
									name: "Artista Indie (Fallback)",
									genres: ["indie", "indie pop"],
									images: [{ url: "https://placehold.co/300x300/teal/white?text=Indie+Artist", height: 300, width: 300 }],
									popularity: 78
								}
							],
							limit: limit,
							next: null,
							offset: offset,
							previous: null,
							total: 3
						};
					}
				} catch (error) {
					console.error('Error al obtener top artists:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener top artists',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'recently-played':
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					
					console.log(`API: Intentando obtener recently played (limit=${limit})`);
					
					try {
						// Obtener las canciones reproducidas recientemente
						data = await sp.getRecentlyPlayed({ 
							limit: limit > 50 ? 50 : limit
						});
						
						console.log('API: Recently played tracks obtenidos correctamente:', data.items?.length || 0);
					} catch (recentlyPlayedError) {
						console.error('API: Error en endpoint de recently played tracks:', recentlyPlayedError);
						
						// Plan B: Intentar con top tracks como alternativa
						console.log('API: Intentando fallback con top tracks');
						try {
							const topTracks = await sp.getMyTopTracks({ 
								limit: limit > 50 ? 50 : limit,
								time_range: 'short_term'
							});
							
							// Transformar formato para que coincida con recently played
							const now = new Date();
							data = {
								href: "https://api.spotify.com/v1/me/player/recently-played",
								items: topTracks.items.map((track: any, index: number) => ({
									track: track,
									played_at: new Date(now.getTime() - (index * 1000 * 60 * 60)).toISOString() // Espaciar por horas
								})),
								next: null,
								cursors: { after: null, before: null },
								limit: topTracks.items.length,
								total: topTracks.items.length
							};
							
							console.log('API: Usando top tracks como alternativa para recently played:', data.items?.length || 0);
						} catch (topTracksError) {
							console.error('API: También falló el fallback de top tracks:', topTracksError);
							
							// Plan C: Si todo falla, devolver datos mockeados
							console.log('API: Devolviendo datos mockeados para recently played');
							const now = new Date();
							data = {
								href: "https://api.spotify.com/v1/me/player/recently-played",
								items: [
									{
										track: {
											id: "fallback_track_1",
											name: "Canción Reciente (Fallback)",
											artists: [{ name: "Artista Popular", id: "artist_1" }],
											album: {
												name: "Álbum Popular",
												id: "album_1",
												images: [{ url: "https://placehold.co/300x300/teal/white?text=Recent+1", height: 300, width: 300 }]
											},
											duration_ms: 180000
										},
										played_at: new Date(now.getTime() - (1000 * 60 * 60)).toISOString() // 1 hora atrás
									},
									{
										track: {
											id: "fallback_track_2",
											name: "Otra Canción (Fallback)",
											artists: [{ name: "Otro Artista", id: "artist_2" }],
											album: {
												name: "Álbum Reciente",
												id: "album_2",
												images: [{ url: "https://placehold.co/300x300/navy/white?text=Recent+2", height: 300, width: 300 }]
											},
											duration_ms: 210000
										},
										played_at: new Date(now.getTime() - (2 * 1000 * 60 * 60)).toISOString() // 2 horas atrás
									}
								],
								next: null,
								cursors: { after: null, before: null },
								limit: limit,
								total: 2
							};
						}
					}
				} catch (error) {
					console.error('Error al obtener recently played tracks:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener recently played tracks',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'saved-tracks':
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const market = searchParams.get('market') || 'ES';
					
					console.log(`API: Intentando obtener saved tracks (limit=${limit}, offset=${offset})`);
					
					try {
						// Obtener las canciones guardadas del usuario
						data = await sp.getMySavedTracks({ 
							limit: limit > 50 ? 50 : limit,
							offset,
							market
						});
						
						console.log('API: Saved tracks obtenidos correctamente:', data.items?.length || 0);
					} catch (savedTracksError) {
						console.error('API: Error en endpoint de saved tracks:', savedTracksError);
						
						// Datos mockeados en caso de fallo
						console.log('API: Devolviendo datos mockeados para saved tracks');
						data = {
							href: "https://api.spotify.com/v1/me/tracks",
							items: [
								{
									added_at: new Date().toISOString(),
									track: {
										id: "fallback_saved_1",
										name: "Canción Favorita (Fallback)",
										artists: [{ name: "Artista Favorito", id: "artist_1" }],
										album: {
											name: "Colección Personal",
											id: "album_1",
											images: [{ url: "https://placehold.co/300x300/green/white?text=Saved+1", height: 300, width: 300 }]
										},
										duration_ms: 195000
									}
								},
								{
									added_at: new Date(Date.now() - 86400000).toISOString(), // 1 día atrás
									track: {
										id: "fallback_saved_2",
										name: "Mi Playlist (Fallback)",
										artists: [{ name: "Artista Descubierto", id: "artist_2" }],
										album: {
											name: "Descubrimientos",
											id: "album_2",
											images: [{ url: "https://placehold.co/300x300/gold/black?text=Saved+2", height: 300, width: 300 }]
										},
										duration_ms: 225000
									}
								}
							],
							limit: limit,
							next: null,
							offset: offset,
							previous: null,
							total: 2
						};
					}
				} catch (error) {
					console.error('Error al obtener saved tracks:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener saved tracks',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'recommended':
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					const market = searchParams.get('market') || 'ES';
					
					console.log(`API: Intentando obtener recomendaciones (limit=${limit})`);
					
					try {
						// Obtener semillas para recomendaciones
						const seedTracks = searchParams.get('seed_tracks');
						const seedArtists = searchParams.get('seed_artists');
						
						// Intentar obtener géneros semilla para recomendaciones
						const availableGenres = await sp.getAvailableGenreSeeds();
						// Solo añadir géneros si no tenemos suficientes semillas de tracks/artists
						const numSeeds = (seedTracks?.split(',').length || 0) + (seedArtists?.split(',').length || 0);
						const maxGenres = Math.min(5 - numSeeds, availableGenres.genres.length);
						
						// Solo usar géneros si es necesario para complementar
						const seedGenres = maxGenres > 0 ? availableGenres.genres.slice(0, maxGenres) : [];
						
						console.log(`API: Generando recomendaciones con ${seedTracks ? seedTracks.split(',').length : 0} tracks, ${seedArtists ? seedArtists.split(',').length : 0} artistas y ${seedGenres.length} géneros como semilla`);
						
						let recommendationOptions: any = {
							limit: limit > 100 ? 100 : limit,
							market
						};
						
						// Añadir semillas solo si tienen valores
						if (seedTracks && seedTracks.length > 0) {
							recommendationOptions.seed_tracks = seedTracks.split(',');
						}
						
						if (seedArtists && seedArtists.length > 0) {
							recommendationOptions.seed_artists = seedArtists.split(',');
						}
						
						// Solo añadir géneros si no tenemos suficientes semillas
						if (seedGenres.length > 0 && numSeeds < 5) {
							recommendationOptions.seed_genres = seedGenres;
						}
						
						data = await sp.getRecommendations(recommendationOptions);
						
						console.log('API: Recomendaciones obtenidas correctamente:', data.tracks?.length || 0);
					} catch (recommendationsError) {
						console.error('API: Error en endpoint de recomendaciones:', recommendationsError);
						
						// Intentar un enfoque alternativo si falló el primero
						try {
							console.log('API: Intentando obtener recomendaciones con enfoque alternativo...');
							const topTracks = await sp.getMyTopTracks({ limit: 5 });
							
							if (topTracks.items && topTracks.items.length > 0) {
								const topTrackIds = topTracks.items.slice(0, 2).map((track: any) => track.id);
								
								data = await sp.getRecommendations({
									seed_tracks: topTrackIds,
									limit: limit > 100 ? 100 : limit,
									market
								});
								
								console.log('API: Recomendaciones alternativas obtenidas correctamente:', data.tracks?.length || 0);
							} else {
								throw new Error('No se pudieron obtener top tracks para recomendaciones alternativas');
							}
						} catch (altRecommendationsError) {
							// Si también falla el enfoque alternativo, usar datos mockeados
							console.error('API: También falló el enfoque alternativo de recomendaciones:', altRecommendationsError);
							console.log('API: Devolviendo datos mockeados para recomendaciones');
							
							// Devolver datos mockeados en caso de fallo
							data = {
								seeds: [],
								tracks: [
									{
										id: "fallback_rec_1",
										name: "Recomendación Popular (API Fallback)",
										artists: [{ name: "Artista Recomendado", id: "artist_1" }],
										album: {
											name: "Descubrimientos Recientes",
											id: "album_1",
											images: [{ url: "https://placehold.co/300x300/blue/white?text=Rec+1", height: 300, width: 300 }]
										},
										duration_ms: 215000,
										popularity: 85
									},
									{
										id: "fallback_rec_2",
										name: "Tendencia Musical (API Fallback)",
										artists: [{ name: "Artista Emergente", id: "artist_2" }],
										album: {
											name: "Lanzamientos Nuevos",
											id: "album_2",
											images: [{ url: "https://placehold.co/300x300/purple/white?text=Rec+2", height: 300, width: 300 }]
										},
										duration_ms: 185000,
										popularity: 90
									}
								]
							};
						}
					}
				} catch (error) {
					console.error('Error al obtener recomendaciones:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener recomendaciones',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'saved':
				// Alias para saved-tracks para mantener compatibilidad con código existente
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const market = searchParams.get('market') || 'ES';
					
					console.log(`API: Alias 'saved' llamado, redirigiendo a 'saved-tracks' (limit=${limit}, offset=${offset})`);
					
					try {
						// Obtener las canciones guardadas del usuario
						data = await sp.getMySavedTracks({ 
							limit: limit > 50 ? 50 : limit,
							offset,
							market
						});
						
						console.log('API: Saved tracks (desde alias) obtenidos correctamente:', data.items?.length || 0);
					} catch (savedTracksError) {
						console.error('API: Error en endpoint de saved (alias):', savedTracksError);
						
						// Datos mockeados en caso de fallo
						console.log('API: Devolviendo datos mockeados para saved tracks (desde alias)');
						data = {
							href: "https://api.spotify.com/v1/me/tracks",
							items: [
								{
									added_at: new Date().toISOString(),
									track: {
										id: "fallback_saved_1",
										name: "Canción Favorita (Fallback)",
										artists: [{ name: "Artista Favorito", id: "artist_1" }],
										album: {
											name: "Colección Personal",
											id: "album_1",
											images: [{ url: "https://placehold.co/300x300/green/white?text=Saved+1", height: 300, width: 300 }]
										},
										duration_ms: 195000
									}
								},
								{
									added_at: new Date(Date.now() - 86400000).toISOString(), // 1 día atrás
									track: {
										id: "fallback_saved_2",
										name: "Mi Playlist (Fallback)",
										artists: [{ name: "Artista Descubierto", id: "artist_2" }],
										album: {
											name: "Descubrimientos",
											id: "album_2",
											images: [{ url: "https://placehold.co/300x300/gold/black?text=Saved+2", height: 300, width: 300 }]
										},
										duration_ms: 225000
									}
								}
							],
							limit: limit,
							next: null,
							offset: offset,
							previous: null,
							total: 2
						};
					}
				} catch (error) {
					console.error('Error al obtener saved tracks (alias):', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener saved tracks',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;
				
			case 'available-genres':
				try {
					console.log('API: Obteniendo géneros disponibles de Spotify');
					try {
						// Obtener los géneros disponibles desde Spotify
					data = await sp.getAvailableGenreSeeds();
						console.log('API: Géneros obtenidos correctamente:', data.genres?.length || 0);
					} catch (genresError) {
						console.error('API: Error al obtener géneros disponibles:', genresError);
						
						// Si hay error, devolver géneros por defecto
						console.log('API: Devolviendo lista predefinida de géneros');
						data = {
							genres: [
								'pop', 'rock', 'hip-hop', 'electronic', 'latin', 'jazz', 
								'classical', 'indie', 'metal', 'r&b', 'reggae', 'country', 
								'alternative', 'dance', 'blues', 'soul'
							]
						};
					}
				} catch (error) {
					console.error('Error al obtener géneros disponibles:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener géneros disponibles',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'categories':
				try {
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const country = searchParams.get('country') || 'ES';
					
					console.log(`API: Obteniendo categorías de Spotify (limit=${limit}, offset=${offset}, country=${country})`);
					
					try {
						// Obtener las categorías de Spotify
						data = await sp.getCategories({ 
							limit: limit > 50 ? 50 : limit,
							offset,
							country
						});
						console.log('API: Categorías obtenidas correctamente:', data.categories?.items?.length || 0);
					} catch (categoriesError) {
						console.error('API: Error al obtener categorías:', categoriesError);
						
						// Si hay error, devolver categorías predefinidas
						console.log('API: Devolviendo lista predefinida de categorías');
						data = {
							categories: {
								href: "https://api.spotify.com/v1/browse/categories",
								items: [
									{
										id: "pop",
										name: "Pop",
										icons: [{ url: "https://placehold.co/300x300/ff69b4/white?text=Pop", height: 300, width: 300 }]
									},
									{
										id: "hiphop",
										name: "Hip Hop",
										icons: [{ url: "https://placehold.co/300x300/800080/white?text=Hip+Hop", height: 300, width: 300 }]
									},
									{
										id: "rock",
										name: "Rock",
										icons: [{ url: "https://placehold.co/300x300/ff0000/white?text=Rock", height: 300, width: 300 }]
									},
									{
										id: "latin",
										name: "Latino",
										icons: [{ url: "https://placehold.co/300x300/ffa500/white?text=Latino", height: 300, width: 300 }]
									},
									{
										id: "edm_dance",
										name: "Electrónica",
										icons: [{ url: "https://placehold.co/300x300/00ffff/black?text=Electronic", height: 300, width: 300 }]
									},
									{
										id: "rnb",
										name: "R&B",
										icons: [{ url: "https://placehold.co/300x300/0000ff/white?text=R%26B", height: 300, width: 300 }]
									},
									{
										id: "indie_alt",
										name: "Indie",
										icons: [{ url: "https://placehold.co/300x300/008000/white?text=Indie", height: 300, width: 300 }]
									},
									{
										id: "jazz",
										name: "Jazz",
										icons: [{ url: "https://placehold.co/300x300/8b4513/white?text=Jazz", height: 300, width: 300 }]
									},
									{
										id: "classical",
										name: "Clásica",
										icons: [{ url: "https://placehold.co/300x300/a0522d/white?text=Classical", height: 300, width: 300 }]
									},
									{
										id: "metal",
										name: "Metal",
										icons: [{ url: "https://placehold.co/300x300/000000/white?text=Metal", height: 300, width: 300 }]
									}
								],
								limit: limit,
								next: null,
								offset: offset,
								previous: null,
								total: 10
							}
						};
					}
				} catch (error) {
					console.error('Error al obtener categorías:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener categorías',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'category-playlists':
				try {
					const categoryId = searchParams.get('categoryId');
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const market = searchParams.get('market') || 'ES';
					
					if (!categoryId) {
						return new Response(JSON.stringify({ error: 'ID de categoría requerido' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}
					
					console.log(`API: Obteniendo playlists de categoría ${categoryId} (limit=${limit}, offset=${offset})`);
					
					try {
						const response = await sp.getCategoryPlaylists(categoryId, {
							limit: limit > 50 ? 50 : limit,
							offset,
							country: market
						});
						
						data = response;
						console.log('API: Playlists de categoría obtenidas correctamente:', data.playlists?.items?.length || 0);
					} catch (categoryError: any) {
						console.error(`API: Error al obtener playlists de categoría ${categoryId}:`, categoryError);
						
						// Verificar si es un error 404 (categoría no encontrada)
						const errorStatus = categoryError?.statusCode || 
							categoryError?.body?.error?.status || 
							(categoryError.message && categoryError.message.includes('404') ? 404 : null);
						
						let errorMsg = categoryError?.body?.error?.message || categoryError?.message || 'Error desconocido';
						
						// Si es error 404, buscar categorías alternativas o proporcionar fallback específico
						if (errorStatus === 404) {
							console.log(`API: Categoría ${categoryId} no encontrada, intentando búsqueda alternativa...`);
							
							// Enfoques alternativos para obtener playlists cuando una categoría no existe:
							
							// 1. Intentar buscar playlists por término relacionado con la categoría
							const categoryIdParts = categoryId.split('_');
							const searchTerm = categoryIdParts.length > 1 ? categoryIdParts.join(' ') : categoryId;
							
							try {
								console.log(`API: Buscando playlists con término "${searchTerm}" como alternativa...`);
								const searchResponse = await sp.searchPlaylists(searchTerm, { 
									limit: limit > 50 ? 50 : limit,
									market
								});
								
								if (searchResponse?.items?.length > 0) {
									data = {
										playlists: {
											items: searchResponse.items,
											limit: limit,
											offset: 0,
											total: searchResponse.items.length,
											href: searchResponse.href || "",
											next: searchResponse.next,
											previous: searchResponse.previous
										},
										message: `Playlists alternativas para "${searchTerm}"`
									};
									console.log(`API: Encontradas ${searchResponse.items.length} playlists alternativas`);
									break; // Salir del caso si encontramos una alternativa exitosa
								}
							} catch (searchError) {
								console.error(`API: Error en búsqueda alternativa:`, searchError);
								// Continuar con otros intentos si la búsqueda falla
							}
							
							// 2. Intentar con playlists destacadas si la búsqueda falló
							try {
								console.log(`API: Intentando con featured playlists como segunda alternativa...`);
								const featuredResponse = await sp.getFeaturedPlaylists({ 
									limit: limit > 50 ? 50 : limit,
									offset,
									locale: 'es_ES'
								});
								
								if (featuredResponse.playlists?.items?.length > 0) {
									data = {
										playlists: featuredResponse.playlists,
										message: `Playlists destacadas (categoría original no disponible)`
									};
									console.log(`API: Usando featured playlists como alternativa: ${featuredResponse.playlists.items.length} playlists`);
									break; // Salir del caso si encontramos una alternativa exitosa
								}
							} catch (featuredError) {
								console.error(`API: Error en featured playlists como alternativa:`, featuredError);
								// Continuar con fallback si featured también falla
							}
						}
						
						// 3. Fallback como último recurso: datos ficticios relacionados con la categoría
						console.log(`API: Generando datos fallback para categoría ${categoryId}`);
						
						// Convertir categotyId a un nombre más amigable para el usuario
						const categoryName = categoryId
							.split('_')
							.map(word => word.charAt(0).toUpperCase() + word.slice(1))
							.join(' ');
						
						// Generar imágenes relacionadas con colores basados en el ID de categoría
						let colorHue = 0;
						for (let i = 0; i < categoryId.length; i++) {
							colorHue = (colorHue + categoryId.charCodeAt(i)) % 360;
						}
						
						const bgColor = `hsl(${colorHue}, 70%, 40%)`;
						const textColor = colorHue > 60 && colorHue < 180 ? 'black' : 'white';
						
						data = {
							playlists: {
								items: [
									{
										id: `fallback_playlist_${categoryId}_1`,
										name: `${categoryName} Mix (Colección Local)`,
										description: `Esta lista contiene música seleccionada para ti en la categoría ${categoryName}`,
										images: [{ url: `https://placehold.co/300x300/${bgColor.replace('#', '')}/${textColor}?text=${encodeURIComponent(`${categoryName} Mix`)}`, height: 300, width: 300 }],
										owner: { display_name: "MusicVerse" },
										tracks: { total: 25 }
									},
									{
										id: `fallback_playlist_${categoryId}_2`,
										name: `Lo Mejor de ${categoryName} (Selección especial)`,
										description: `Descubre grandes éxitos y joyas ocultas de la categoría ${categoryName}`,
										images: [{ url: `https://placehold.co/300x300/${(parseInt(bgColor.replace('#', ''), 16) + 0x111111).toString(16).padStart(6, '0')}/${textColor}?text=${encodeURIComponent(`${categoryName} Best`)}`, height: 300, width: 300 }],
										owner: { display_name: "MusicVerse" },
										tracks: { total: 30 }
									}
								],
								limit: limit,
								next: null,
								offset: offset,
								previous: null,
								total: 2
							}
						};
					}
				} catch (error) {
					console.error('Error al obtener playlists de categoría:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener playlists de categoría',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'genre-recommendations':
				try {
					const genre = searchParams.get('genre');
					const limit = parseInt(searchParams.get('limit') || '30');
					const combineResults = searchParams.get('combine') === 'true';
					const source = searchParams.get('source'); // fuente preferida (opcional)
					
					if (!genre) {
						return new Response(JSON.stringify({ error: 'Género requerido' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}
					
					console.log(`API: Obteniendo recomendaciones avanzadas para ${genre} (limit=${limit})`);
					
					// Validar que el valor de source es uno de los permitidos
					let validatedSource: 'spotify' | 'deezer' | 'lastfm' | 'youtube' | undefined = undefined;
					if (source) {
						if (['spotify', 'deezer', 'lastfm', 'youtube'].includes(source)) {
							validatedSource = source as 'spotify' | 'deezer' | 'lastfm' | 'youtube';
						} else {
							console.warn(`API: Fuente no reconocida '${source}', usando valor por defecto`);
						}
					}
					
					const tracks = await getRecommendationsByGenre(genre, limit, {
						combineResults,
						preferredSource: validatedSource
					});
					
					data = { tracks };
					console.log(`API: Recomendaciones obtenidas: ${tracks.length} tracks`);
				} catch (error) {
					console.error('Error al obtener recomendaciones por género:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al obtener recomendaciones por género',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			case 'search-artists':
				try {
					const query = searchParams.get('query');
					const limit = parseInt(searchParams.get('limit') || '20');
					const offset = parseInt(searchParams.get('offset') || '0');
					const market = searchParams.get('market') || 'ES';
					
					if (!query) {
						return new Response(JSON.stringify({ error: 'Query requerido' }), {
							status: 400,
							headers: { 'Content-Type': 'application/json' }
						});
					}
					
					console.log(`API: Buscando artistas con query '${query}' (limit=${limit})`);
					
					// Para búsqueda por género, verificar si contiene "genre:" y extraer el género
					let searchQuery = query;
					let isGenreSearch = false;
					
					if (query.toLowerCase().startsWith('genre:')) {
						isGenreSearch = true;
						const genreName = query.substring('genre:'.length);
						console.log(`API: Búsqueda de artistas por género '${genreName}'`);
						
						// Para búsqueda por género, hay que usar un enfoque diferente ya que
						// Spotify no soporta búsqueda directa por género
						searchQuery = genreName; // Buscar artistas con el nombre del género
					}
					
					try {
						const results = await sp.searchArtists(searchQuery, {
							limit: limit > 50 ? 50 : limit,
							offset,
							market
						});
						
						data = results.artists || { items: [] };
						console.log(`API: Artistas encontrados para '${query}':`, data.items?.length || 0);
						
						// Si no hay resultados y es búsqueda por género, intentar
						// un enfoque más genérico
						if (isGenreSearch && (!data.items || data.items.length === 0)) {
							console.log(`API: No se encontraron artistas con búsqueda directa para género, intentando con artistas populares`);
							
							// Obtener artistas populares
							const topArtists = await sp.getMyTopArtists({
								limit: limit > 50 ? 50 : limit
							});
							
							// Filtrar para incluir solo aquellos que tengan el género
							const genreName = searchQuery.toLowerCase();
							const filteredArtists = topArtists.items.filter((artist: any) => 
								artist.genres && artist.genres.some((g: string) => g.toLowerCase().includes(genreName))
							);
							
							if (filteredArtists.length > 0) {
								data = {
									items: filteredArtists,
									limit,
									offset,
									total: filteredArtists.length,
									href: "",
									next: null,
									previous: null
								};
								console.log(`API: Encontrados ${filteredArtists.length} artistas por filtrado de géneros`);
							}
						}
					} catch (searchError) {
						console.error(`API: Error en búsqueda de artistas para '${query}':`, searchError);
						
						// Devolver datos mockeados como fallback
						data = {
							items: [
								{
									id: `fallback_artist_${isGenreSearch ? searchQuery : 'search'}_1`,
									name: `Artista de ${isGenreSearch ? searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1) : 'Música'} (Fallback)`,
									genres: isGenreSearch ? [searchQuery] : ["pop", "rock"],
									images: [{ url: `https://placehold.co/300x300/blue/white?text=Artist+1`, height: 300, width: 300 }],
									popularity: 85
								},
								{
									id: `fallback_artist_${isGenreSearch ? searchQuery : 'search'}_2`,
									name: `${isGenreSearch ? searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1) : ''} Performer (Fallback)`,
									genres: isGenreSearch ? [searchQuery] : ["pop"],
									images: [{ url: `https://placehold.co/300x300/red/white?text=Artist+2`, height: 300, width: 300 }],
									popularity: 80
								}
							],
							limit,
							offset,
							total: 2,
							href: "",
							next: null,
							previous: null
						};
					}
				} catch (error) {
					console.error('Error al buscar artistas:', error);
					return new Response(JSON.stringify({ 
						error: 'Error al buscar artistas',
						details: (error as Error).message 
					}), {
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				break;

			default:
				console.log(`API: Acción '${action}' no soportada`);
				return new Response(JSON.stringify({ error: 'Acción no soportada' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
		}

		if (data === null) {
			return new Response(JSON.stringify({ error: 'Acción no soportada' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
		}

		return new Response(JSON.stringify(data), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('API Spotify Error:', error);
		return new Response(
			JSON.stringify({
				error: 'Error en la API de Spotify',
			details: (error as Error).message
			}),
			{
			status: 500,
			headers: { 'Content-Type': 'application/json' }
			}
		);
	}
} 