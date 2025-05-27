import { NextResponse } from 'next/server';
import { getSpotifyArtistTopTracks, formatSpotifyTrack } from '@/lib/spotify-server';
import { Track } from '@/types/types';

export const dynamic = 'force-dynamic'; // Avoid static generation

export async function GET(
    request: Request,
    { params }: { params: { artistId: string } }
) {
    const artistId = params.artistId;

    if (!artistId) {
        return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 });
    }

    console.log(`[API Top Tracks] Received request for top tracks of Spotify artist ID: ${artistId}`);

    try {
        const spotifyTracks = await getSpotifyArtistTopTracks(artistId);

        if (!spotifyTracks || spotifyTracks.length === 0) {
            console.log(`[API Top Tracks] No top tracks found for Spotify artist ID: ${artistId}`);
            return NextResponse.json({ topTracks: [] }); // Return empty array if no tracks found
        }

        console.log(`[API Top Tracks] Found ${spotifyTracks.length} top tracks for Spotify artist ID: ${artistId}`);

        // Format tracks
        const formattedTracks: Track[] = spotifyTracks.map(formatSpotifyTrack);

        return NextResponse.json({ topTracks: formattedTracks });

    } catch (error) {
        console.error(`[API Top Tracks] Error fetching top tracks for Spotify artist ID ${artistId}:`, error);
        return NextResponse.json({ error: 'Failed to fetch top tracks from Spotify' }, { status: 500 });
    }
}
