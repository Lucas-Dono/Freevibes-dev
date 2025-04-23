import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateUserProfile, getUserBySpotifyId } from '@/lib/db/services/userService';

export async function GET(request: NextRequest) {
  try {
    // Obtener información del usuario actual
    const userCookie = cookies().get('spotify_user')?.value;

    if (!userCookie) {
      return NextResponse.json(
        { error: 'No estás autenticado' },
        { status: 401 }
      );
    }

    const userData = JSON.parse(userCookie);
    const spotifyId = userData.id;

    // Consultar información completa en la base de datos
    const user = await getUserBySpotifyId(spotifyId);

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Retornar el perfil completo del usuario
    return NextResponse.json({
      id: user._id,
      spotifyId: user.spotifyId,
      name: user.name,
      username: user.username || '',
      email: user.email,
      bio: user.bio || '',
      profileImage: user.profileImage || '',
      coverImage: user.coverImage || '',
      favoriteGenres: user.favoriteGenres || [],
      followers: user.followers,
      following: user.following,
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Obtener la cookie del usuario
    const userCookie = cookies().get('spotify_user')?.value;

    if (!userCookie) {
      return NextResponse.json(
        { error: 'No estás autenticado' },
        { status: 401 }
      );
    }

    // Obtener el ID de Spotify del usuario
    const userData = JSON.parse(userCookie);
    const spotifyId = userData.id;

    // Obtener los datos actualizados del body
    const body = await request.json();

    // Validar datos recibidos
    if (!body) {
      return NextResponse.json(
        { error: 'No se recibieron datos para actualizar' },
        { status: 400 }
      );
    }

    // Extraer solo los campos permitidos
    const updateData = {
      username: body.username,
      bio: body.bio,
      profileImage: body.profileImage,
      coverImage: body.coverImage,
      favoriteGenres: body.favoriteGenres
    };

    // Actualizar el perfil del usuario
    const updatedUser = await updateUserProfile(spotifyId, updateData);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'No se pudo actualizar el perfil' },
        { status: 400 }
      );
    }

    // Retornar el perfil actualizado
    return NextResponse.json({
      id: updatedUser._id,
      spotifyId: updatedUser.spotifyId,
      name: updatedUser.name,
      username: updatedUser.username || '',
      email: updatedUser.email,
      bio: updatedUser.bio || '',
      profileImage: updatedUser.profileImage || '',
      coverImage: updatedUser.coverImage || '',
      favoriteGenres: updatedUser.favoriteGenres || [],
      followers: updatedUser.followers,
      following: updatedUser.following,
    });

  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
