# FreeVibes Android - Configuración del Entorno de Desarrollo

## Requisitos del Sistema

### 1. Java Development Kit (JDK)

**Versión Requerida**: JDK 11 o superior (recomendado JDK 17)

#### Instalación en Windows:

1. **Descargar JDK**:
   - [Oracle JDK](https://www.oracle.com/java/technologies/downloads/)
   - [OpenJDK](https://adoptium.net/) (recomendado, gratuito)

2. **Instalar JDK**:
   - Ejecutar el instalador descargado
   - Seguir las instrucciones del asistente
   - Anotar la ruta de instalación (ej: `C:\Program Files\Eclipse Adoptium\jdk-17.0.9.9-hotspot`)

3. **Configurar Variables de Entorno**:
   ```cmd
   # Abrir "Variables de entorno" desde el Panel de Control
   # O ejecutar: sysdm.cpl -> Opciones avanzadas -> Variables de entorno
   
   # Agregar nueva variable del sistema:
   JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.0.9.9-hotspot
   
   # Editar variable PATH, agregar:
   %JAVA_HOME%\bin
   ```

4. **Verificar Instalación**:
   ```cmd
   java -version
   javac -version
   ```

### 2. Android SDK

#### Opción A: Android Studio (Recomendado)

1. **Descargar Android Studio**:
   - [Sitio oficial](https://developer.android.com/studio)

2. **Instalar Android Studio**:
   - Ejecutar el instalador
   - Seguir el asistente de configuración
   - Descargar SDK automáticamente

3. **Configurar SDK**:
   - Abrir Android Studio
   - Tools → SDK Manager
   - Instalar:
     - Android SDK Platform 34 (API 34)
     - Android SDK Build-Tools 34.0.0
     - Android SDK Platform-Tools
     - Android SDK Tools

#### Opción B: SDK Command Line Tools

1. **Descargar Command Line Tools**:
   - [SDK Command Line Tools](https://developer.android.com/studio#command-tools)

2. **Configurar Variables de Entorno**:
   ```cmd
   ANDROID_HOME = C:\Users\%USERNAME%\AppData\Local\Android\Sdk
   
   # Agregar al PATH:
   %ANDROID_HOME%\tools
   %ANDROID_HOME%\tools\bin
   %ANDROID_HOME%\platform-tools
   ```

### 3. Git (Opcional pero recomendado)

1. **Descargar Git**:
   - [Git for Windows](https://git-scm.com/download/win)

2. **Instalar Git**:
   - Ejecutar el instalador
   - Usar configuración por defecto

## Verificación de la Configuración

### Script de Verificación

Crear un archivo `verify_setup.bat` en el directorio `android/`:

```batch
@echo off
echo ========================================
echo Verificando Configuración del Entorno
echo ========================================
echo.

echo [1/4] Verificando Java...
java -version
if %errorlevel% neq 0 (
    echo ERROR: Java no está instalado o configurado
    echo Instalar JDK 11+ y configurar JAVA_HOME
    goto :error
)
echo Java: OK
echo.

echo [2/4] Verificando Android SDK...
if not defined ANDROID_HOME (
    echo ERROR: ANDROID_HOME no está configurado
    echo Configurar variable de entorno ANDROID_HOME
    goto :error
)
echo ANDROID_HOME: %ANDROID_HOME%
echo.

echo [3/4] Verificando ADB...
adb version
if %errorlevel% neq 0 (
    echo WARNING: ADB no está disponible
    echo Verificar que ANDROID_HOME/platform-tools esté en PATH
)
echo.

echo [4/4] Verificando Gradle...
.\gradlew.bat --version
if %errorlevel% neq 0 (
    echo ERROR: Gradle Wrapper no funciona
    goto :error
)
echo Gradle: OK
echo.

echo ========================================
echo Configuración COMPLETA
echo ========================================
goto :end

:error
echo ========================================
echo Configuración INCOMPLETA
echo Revisar los errores anteriores
echo ========================================

:end
pause
```

### Comandos de Verificación Manual

```cmd
# Verificar Java
java -version
echo %JAVA_HOME%

# Verificar Android SDK
echo %ANDROID_HOME%
adb version

# Verificar Gradle
cd android
.\gradlew.bat --version

# Test básico del proyecto
.\gradlew.bat clean
.\gradlew.bat build
```

## Configuración del IDE

### Android Studio

1. **Abrir Proyecto**:
   - File → Open
   - Seleccionar carpeta `android/`

2. **Configurar SDK**:
   - File → Project Structure
   - SDK Location → verificar rutas

3. **Sincronizar Gradle**:
   - Tools → Android → Sync Project with Gradle Files

### Visual Studio Code (Alternativo)

1. **Instalar Extensiones**:
   - Android iOS Emulator
   - Gradle for Java
   - Extension Pack for Java

2. **Configurar Workspace**:
   - Abrir carpeta `android/`
   - Configurar `settings.json`:
   ```json
   {
     "java.home": "C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.9.9-hotspot",
     "android.home": "C:\\Users\\%USERNAME%\\AppData\\Local\\Android\\Sdk"
   }
   ```

## Configuración de Emulador

### Crear AVD (Android Virtual Device)

1. **Desde Android Studio**:
   - Tools → AVD Manager
   - Create Virtual Device
   - Seleccionar: Pixel 4, API 30 (Android 11)
   - Configurar: 2GB RAM, 4GB Storage

2. **Desde Command Line**:
   ```cmd
   # Listar targets disponibles
   avdmanager list target
   
   # Crear AVD
   avdmanager create avd -n FreeVibes_Test -k "system-images;android-30;google_apis;x86_64"
   
   # Iniciar emulador
   emulator -avd FreeVibes_Test
   ```

### Configurar Dispositivo Físico

1. **Habilitar Opciones de Desarrollador**:
   - Configuración → Acerca del teléfono
   - Tocar "Número de compilación" 7 veces

2. **Habilitar Depuración USB**:
   - Configuración → Opciones de desarrollador
   - Activar "Depuración USB"

3. **Verificar Conexión**:
   ```cmd
   adb devices
   ```

## Solución de Problemas Comunes

### Error: "JAVA_HOME is not set"

```cmd
# Verificar JAVA_HOME
echo %JAVA_HOME%

# Configurar temporalmente
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.9.9-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
```

### Error: "SDK location not found"

```cmd
# Verificar ANDROID_HOME
echo %ANDROID_HOME%

# Configurar temporalmente
set ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk
set PATH=%ANDROID_HOME%\platform-tools;%PATH%
```

### Error: "Gradle sync failed"

1. **Limpiar cache de Gradle**:
   ```cmd
   .\gradlew.bat clean
   rmdir /s .gradle
   ```

2. **Verificar conexión a internet**
3. **Reiniciar Android Studio**

### Error: "No connected devices"

1. **Verificar emulador**:
   ```cmd
   adb devices
   emulator -list-avds
   ```

2. **Reiniciar ADB**:
   ```cmd
   adb kill-server
   adb start-server
   ```

## Próximos Pasos

Una vez completada la configuración:

1. **Ejecutar Tests**:
   ```cmd
   cd android
   .\gradlew.bat test
   .\gradlew.bat connectedAndroidTest
   ```

2. **Build del Proyecto**:
   ```cmd
   .\gradlew.bat build
   ```

3. **Instalar en Dispositivo**:
   ```cmd
   .\gradlew.bat installDebug
   ```

## Recursos Adicionales

- [Android Developer Documentation](https://developer.android.com/docs)
- [Gradle User Manual](https://docs.gradle.org/current/userguide/userguide.html)
- [Android Studio User Guide](https://developer.android.com/studio/intro)
- [ADB Documentation](https://developer.android.com/studio/command-line/adb)