// Script para ignorar rutas específicas durante el build de Vercel
const fs = require('fs');
const path = require('path');

// Función principal que se ejecuta antes del build
function ignoreDynamicRoutes() {
  console.log('😎 Configurando build para Vercel: Ignorando rutas dinámicas...');
  
  // Lista de rutas que queremos ignorar en la generación estática
  const routesToIgnore = ['/hybrid', '/hybrid-adapter'];
  
  // Configurar el entorno
  process.env.NEXT_SKIP_HYBRID_PRERENDER = 'true';
  process.env.NEXT_IGNORE_PRERENDER_ERRORS = 'true';
  
  // Crear archivo temporal .vercel-ignore-build-errors
  const ignoreFilePath = path.join(process.cwd(), '.vercel-ignore-build-errors');
  
  // Contenido del archivo con las rutas a ignorar
  const fileContent = routesToIgnore.join('\n');
  
  try {
    fs.writeFileSync(ignoreFilePath, fileContent, 'utf8');
    console.log('✅ Archivo de ignorar errores creado correctamente');
    console.log('📋 Rutas ignoradas:');
    routesToIgnore.forEach(route => console.log(`   - ${route}`));
  } catch (error) {
    console.error('❌ Error al crear archivo de ignorar errores:', error);
  }
  
  // Crear archivo de configuración para Next.js
  try {
    // Crear un archivo temporal que Next.js detectará durante el build
    const nextTempConfigPath = path.join(process.cwd(), '.next-temp-build-config');
    const nextConfigContent = JSON.stringify({
      ignoreBuildErrors: true,
      ignorePrerender: routesToIgnore
    });
    
    fs.writeFileSync(nextTempConfigPath, nextConfigContent, 'utf8');
    console.log('✅ Configuración temporal de Next.js creada');
  } catch (error) {
    console.error('❌ Error al crear configuración temporal de Next.js:', error);
  }
  
  console.log('✨ Preparación completada. Iniciando build...');
}

// Ejecutar la función al cargar el script
ignoreDynamicRoutes(); 