import { NextResponse } from 'next/server';
import { searchSpotifyArtistId } from '@/lib/spotify-server'; // Corrected import function name

export const dynamic = 'force-dynamic'; // Avoid static generation

export async function GET(request: Request) {
    console.log('[API Find Artist] Request received.'); // <-- LOG B1
    const { searchParams } = new URL(request.url);
    const artistName = searchParams.get('name');
    console.log(`[API Find Artist] Artist name from query: ${artistName}`); // <-- LOG B2

    if (!artistName) {
        console.log('[API Find Artist] Error: Missing artist name.'); // <-- LOG B3
        return NextResponse.json({ error: 'Artist name query parameter is required' }, { status: 400 });
    }

    console.log(`[API Find Artist] Calling searchSpotifyArtistId for: ${artistName}`); // <-- LOG B4

    try {
        const artistId = await searchSpotifyArtistId(artistName); 
        console.log(`[API Find Artist] searchSpotifyArtistId returned: ${artistId}`); // <-- LOG B5

        if (!artistId) {
            console.log(`[API Find Artist] Artist '${artistName}' not found or error occurred.`); // <-- LOG B6
            return NextResponse.json({ error: `Artist '${artistName}' not found on Spotify` }, { status: 404 });
        }

        console.log(`[API Find Artist] Found Spotify ID: ${artistId}. Returning success.`); // <-- LOG B7
        return NextResponse.json({ artistId });
    } catch (error) {
        console.error('[API Find Artist] Unexpected Error in GET handler:', error); // <-- LOG B8
        return NextResponse.json({ error: 'Failed to search for artist on Spotify (Internal Server Error)' }, { status: 500 });
    }
} 