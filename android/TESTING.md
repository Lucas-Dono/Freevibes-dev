# FreeVibes Android - Testing Guide

## Descripción General

Este documento describe la estrategia de testing implementada para la aplicación FreeVibes Android, incluyendo tests unitarios, tests de integración y tests de instrumentación (UI).

## Estructura de Testing

### 1. Tests Unitarios (`src/test/`)

Ubicados en `app/src/test/java/com/freevibes/android/`

#### ViewModels
- **AuthViewModelTest**: Tests para funcionalidades de autenticación
  - Validación de login con credenciales válidas/inválidas
  - Validación de registro
  - Validación de email y contraseña
  - Manejo de estados de error

- **PlayerViewModelTest**: Tests para el reproductor de música
  - Reproducción de tracks
  - Controles de playback (play/pause, skip, shuffle, repeat)
  - Actualización de estados (posición, duración, modo shuffle/repeat)
  - Integración con PlayerService

#### Repositories
- **MusicRepositoryTest**: Tests para operaciones de música
  - Búsqueda de tracks
  - Obtención de tracks trending
  - Gestión de playlists
  - Manejo de errores de red
  - Obtención de tracks por ID

#### APIs
- **MusicApiIntegrationTest**: Tests de integración con MockWebServer
  - Simulación de respuestas del servidor
  - Verificación de requests HTTP
  - Manejo de respuestas exitosas y errores
  - Testing de endpoints principales

### 2. Tests de Instrumentación (`src/androidTest/`)

Ubicados en `app/src/androidTest/java/com/freevibes/android/`

#### UI Tests
- **LoginFragmentTest**: Tests de interfaz para login
  - Validación de campos de entrada
  - Verificación de elementos UI
  - Testing de validaciones en tiempo real
  - Interacciones de usuario

- **HomeFragmentTest**: Tests de interfaz para pantalla principal
  - Verificación de RecyclerViews
  - Testing de swipe refresh
  - Estados de carga y error
  - Navegación y scroll

#### Configuración
- **HiltTestRunner**: Runner personalizado para inyección de dependencias en tests

## Dependencias de Testing

### Unit Testing
```gradle
// Core testing
testImplementation 'junit:junit:4.13.2'
testImplementation 'androidx.arch.core:core-testing:2.2.0'
testImplementation 'org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3'

// Mocking
testImplementation 'org.mockito:mockito-core:5.8.0'
testImplementation 'org.mockito.kotlin:mockito-kotlin:5.2.1'

// Network testing
testImplementation 'com.squareup.okhttp3:mockwebserver:4.12.0'

// Database testing
testImplementation 'androidx.room:room-testing:2.6.1'

// Hilt testing
testImplementation 'com.google.dagger:hilt-android-testing:2.48.1'
```

### Instrumentation Testing
```gradle
// UI testing
androidTestImplementation 'androidx.test.ext:junit:1.1.5'
androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
androidTestImplementation 'androidx.test.espresso:espresso-contrib:3.5.1'
androidTestImplementation 'androidx.test.espresso:espresso-intents:3.5.1'

// Test infrastructure
androidTestImplementation 'androidx.test:runner:1.5.2'
androidTestImplementation 'androidx.test:rules:1.5.0'

// Navigation testing
androidTestImplementation 'androidx.navigation:navigation-testing:2.7.6'

// Hilt testing
androidTestImplementation 'com.google.dagger:hilt-android-testing:2.48.1'
```

## Cómo Ejecutar los Tests

### Opción 1: Script Automatizado
```bash
# Desde el directorio android/
./test_runner.bat
```

Este script ejecuta:
1. Limpieza del proyecto
2. Tests unitarios
3. Build del APK debug
4. Tests de instrumentación (requiere emulador/dispositivo)

### Opción 2: Comandos Gradle Individuales

#### Tests Unitarios
```bash
# Todos los tests unitarios
./gradlew test

# Tests específicos
./gradlew testDebugUnitTest

# Test de una clase específica
./gradlew test --tests "AuthViewModelTest"
```

#### Tests de Instrumentación
```bash
# Todos los tests de instrumentación (requiere dispositivo/emulador)
./gradlew connectedAndroidTest

# Tests específicos
./gradlew connectedDebugAndroidTest
```

#### Build y Verificación
```bash
# Limpiar proyecto
./gradlew clean

# Build completo
./gradlew build

# Verificar código (lint + tests)
./gradlew check
```

### Opción 3: Android Studio

1. **Tests Unitarios**: Click derecho en `src/test` → "Run All Tests"
2. **Tests de Instrumentación**: Click derecho en `src/androidTest` → "Run All Tests"
3. **Test Individual**: Click en el ícono de play junto a cada test

## Reportes de Testing

Después de ejecutar los tests, los reportes están disponibles en:

### Tests Unitarios
- **HTML Report**: `app/build/reports/tests/testDebugUnitTest/index.html`
- **XML Results**: `app/build/test-results/testDebugUnitTest/`

### Tests de Instrumentación
- **HTML Report**: `app/build/reports/androidTests/connected/index.html`
- **XML Results**: `app/build/outputs/androidTest-results/connected/`

### Cobertura de Código
- **Coverage Report**: `app/build/reports/coverage/`

## Configuración del Entorno de Testing

### Para Tests de Instrumentación

1. **Emulador Android**:
   - API Level 24+ (Android 7.0+)
   - Configuración recomendada: Pixel 4, API 30

2. **Dispositivo Físico**:
   - Habilitar "Opciones de desarrollador"
   - Activar "Depuración USB"
   - Conectar vía USB

### Variables de Entorno

Asegúrate de tener configurado:
```bash
ANDROID_HOME=/path/to/android/sdk
PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

## Estrategia de Testing

### 1. Pirámide de Testing
- **70% Tests Unitarios**: Lógica de negocio, ViewModels, Repositories
- **20% Tests de Integración**: APIs, Database, Servicios
- **10% Tests UI**: Flujos críticos de usuario

### 2. Cobertura Objetivo
- **ViewModels**: 90%+
- **Repositories**: 85%+
- **Utilities**: 80%+
- **UI Components**: 60%+

### 3. Tests Críticos
- Autenticación (login/registro)
- Reproducción de música
- Búsqueda de tracks
- Gestión de playlists
- Navegación principal

## Troubleshooting

### Problemas Comunes

1. **"No connected devices"**
   - Verificar que el emulador esté ejecutándose
   - Comprobar `adb devices`

2. **"Hilt component not found"**
   - Verificar que `@HiltAndroidTest` esté presente
   - Usar `HiltTestRunner` en build.gradle

3. **"Network error in tests"**
   - Verificar MockWebServer configuration
   - Comprobar timeouts en OkHttpClient

4. **"Fragment not found"**
   - Verificar imports de testing
   - Usar `launchFragmentInContainer` correctamente

### Logs de Debug

```bash
# Ver logs durante tests
./gradlew test --info

# Ver logs de instrumentación
adb logcat | grep -E "(TestRunner|FreeVibes)"
```

## Próximos Pasos

### Tests Pendientes
1. **SearchFragmentTest**: Testing de búsqueda en tiempo real
2. **LibraryFragmentTest**: Testing de pestañas y navegación
3. **PlayerFragmentTest**: Testing de controles de reproducción
4. **ProfileFragmentTest**: Testing de perfil de usuario

### Mejoras Futuras
1. **Screenshot Testing**: Para verificar UI visualmente
2. **Performance Testing**: Medición de tiempos de carga
3. **Accessibility Testing**: Verificación de accesibilidad
4. **End-to-End Testing**: Flujos completos de usuario

## Recursos Adicionales

- [Android Testing Documentation](https://developer.android.com/training/testing)
- [Espresso Testing Guide](https://developer.android.com/training/testing/espresso)
- [Hilt Testing Guide](https://dagger.dev/hilt/testing)
- [MockWebServer Documentation](https://github.com/square/okhttp/tree/master/mockwebserver)