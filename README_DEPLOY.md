# Guía de Despliegue - MusicVerse

Esta guía explica cómo configurar correctamente las redirecciones de autenticación para el despliegue en producción de la aplicación MusicVerse, especialmente en un entorno distribuido donde el frontend está alojado en Vercel y el backend en Render u otro servicio similar.

## Configuración de Entorno Distribuido

### 1. Configurar URL del Frontend y Backend

En Vercel (para el frontend), configura estas variables de entorno:

```
NEXT_PUBLIC_APP_URL=https://tu-dominio-frontend.com
BACKEND_URL=https://tu-dominio-backend.onrender.com
```

En Render (para el backend), configura:

```
FRONTEND_URL=https://tu-dominio-frontend.com
```

## Configuración de Redirecciones para Servicios de Autenticación

La autenticación de los servicios externos requiere URLs de callback válidas que deben coincidir exactamente con las URLs registradas en los respectivos paneles de desarrollador. La aplicación soporta un modelo flexible donde algunos callbacks pueden manejarse en el frontend y otros en el backend.

### Configuración de Spotify

Spotify generalmente se maneja en el frontend (Vercel):

#### 1. Configurar la URL de callback

```
NEXT_PUBLIC_SPOTIFY_CALLBACK_PATH=/api/auth/spotify/callback
SPOTIFY_CALLBACK_ON_FRONTEND=true
```

#### 2. Actualizar el Dashboard de Spotify

1. Ve a [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Selecciona tu aplicación
3. Ve a "Edit Settings"
4. En "Redirect URIs", añade exactamente: `https://tu-dominio-frontend.com/api/auth/spotify/callback`

### Configuración de LastFM

LastFM generalmente se maneja en el frontend (Vercel):

#### 1. Configurar la URL de callback

```
NEXT_PUBLIC_LASTFM_CALLBACK_PATH=/api/auth/lastfm/callback
LASTFM_CALLBACK_ON_FRONTEND=true
```

#### 2. Actualizar la configuración de LastFM

Añade la URL de callback en tu aplicación LastFM: `https://tu-dominio-frontend.com/api/auth/lastfm/callback`

### Configuración de Deezer

Deezer generalmente se maneja en el backend (Render):

#### 1. Configurar la URL de callback

En Vercel (frontend):
```
NEXT_PUBLIC_DEEZER_CALLBACK_PATH=/api/auth/deezer/callback
DEEZER_CALLBACK_ON_FRONTEND=false
```

En Render (backend):
```
DEEZER_CALLBACK_PATH=/api/auth/deezer/callback
```

#### 2. Actualizar la configuración de Deezer

Añade la URL de callback en tu aplicación Deezer: `https://tu-dominio-backend.onrender.com/api/auth/deezer/callback`

## Opciones de Configuración

Para cada servicio (SPOTIFY, LASTFM, DEEZER), tienes estas opciones:

### Opción 1: Usar solo el path (recomendado)

```
NEXT_PUBLIC_[SERVICIO]_CALLBACK_PATH=/api/auth/[servicio]/callback
```

Esta opción construirá automáticamente la URL completa combinando la URL base con este path.

### Opción 2: Especificar una URL completa

```
NEXT_PUBLIC_[SERVICIO]_CALLBACK_URL=https://dominio-completo.com/api/auth/[servicio]/callback
```

Esto es útil cuando necesitas una URL personalizada diferente a la que se construiría automáticamente.

### Opción 3: Determinar si el callback se maneja en frontend o backend

```
[SERVICIO]_CALLBACK_ON_FRONTEND=true|false
```

- `true`: El callback se maneja en el frontend (Vercel)
- `false`: El callback se maneja en el backend (Render)

## Consideraciones Importantes para Ambientes Distribuidos

1. **CORS**: Asegúrate de configurar CORS adecuadamente en el backend para permitir solicitudes desde el frontend.

2. **Cookies**: Las cookies establecidas por el backend no estarán disponibles en el frontend y viceversa, debido a dominios diferentes. Considera usar almacenamiento local o tokens JWT para comunicación entre servicios.

3. **Seguridad**: Asegúrate de que todas las comunicaciones entre frontend y backend se realicen a través de HTTPS.

4. **Variables de Entorno**: No incluyas secretos en variables de entorno con prefijo `NEXT_PUBLIC_` en el frontend, ya que estos son visibles para los usuarios.

## Solución de Problemas

Si encuentras errores de redirección:

1. Verifica que las URLs de callback registradas en cada servicio coincidan **exactamente** con las que está utilizando la aplicación.

2. Revisa los encabezados CORS en el backend si el frontend recibe errores de acceso cruzado.

3. Usa las herramientas de desarrollo del navegador para verificar las solicitudes y respuestas HTTP.

4. Revisa los logs tanto en Vercel como en Render para detectar posibles errores.

## Seguridad

- Todas las cookies de autenticación se establecen con `secure: true` en producción
- Se utiliza `state` para protección contra CSRF
- Las cookies de tokens tienen `httpOnly: true` para prevenir acceso desde JavaScript 