// Configuración para asegurar que hybrid sea tratado como ruta dinámica
module.exports = {
  dynamicRoutes: ['/hybrid', '/hybrid-adapter'],
  
  // Función auxiliar para verificar si una ruta debe ser tratada como dinámica
  isDynamicRoute: (path) => {
    return path === '/hybrid' || path === '/hybrid-adapter';
  },
  
  // Opciones para Next.js
  nextConfig: {
    // No incluir hybrid en la exportación estática
    excludeExportRoutes: ['/hybrid', '/hybrid-adapter'],
    
    // Configuración para entornos de producción
    productionSettings: {
      serverOnly: true,
      noStaticRender: true,
      dynamicRoutes: true,
      forceServerRender: true
    }
  }
}; 