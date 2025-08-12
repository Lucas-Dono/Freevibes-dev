import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Configuración específica para desarrollo
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ["babel-plugin-styled-components", {
            displayName: true,
            fileName: true,
            pure: true,
            ssr: false
          }]
        ]
      },
      // Habilitar Fast Refresh para desarrollo
      fastRefresh: true
    })
  ],
  
  // Configuración del servidor de desarrollo
  server: {
    port: 3000,
    host: '0.0.0.0', // Permitir acceso desde cualquier IP (útil para Docker)
    open: false, // No abrir automáticamente el navegador
    strictPort: true, // Fallar si el puerto está ocupado
    
    // Configuración de HMR (Hot Module Replacement)
    hmr: {
      port: 3001,
      host: 'localhost'
    },
    
    // Configuración de proxy para desarrollo
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('🔴 Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('🔄 Sending Request to API:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('✅ Received Response from API:', proxyRes.statusCode, req.url);
          });
        }
      },
      
      // Proxy para admin routes
      '/admin': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      },
      
      // Proxy para dashboard routes
      '/dashboard': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      }
    },
    
    // Configuración de CORS para desarrollo
    cors: {
      origin: ['http://localhost:3000', 'http://localhost:5001', 'http://127.0.0.1:3000'],
      credentials: true
    },
    
    // Watch options para mejor rendimiento
    watch: {
      usePolling: true,
      interval: 1000
    }
  },
  
  // Configuración de resolución de módulos
  resolve: {
    alias: {
      // Rutas específicas para dependencias problemáticas
      'styled-components': path.resolve(__dirname, 'node_modules/styled-components'),
      'react-is': path.resolve(__dirname, 'node_modules/react-is'),
      '@emotion/unitless': path.resolve(__dirname, 'node_modules/@emotion/unitless'),
      'hoist-non-react-statics': path.resolve(__dirname, 'node_modules/hoist-non-react-statics'),
      'prop-types': path.resolve(__dirname, 'node_modules/prop-types'),
      
      // Aliases para Emotion
      '@emotion/react': path.resolve(__dirname, 'node_modules/@emotion/react'),
      '@emotion/styled': path.resolve(__dirname, 'node_modules/@emotion/styled'),
      '@emotion/cache': path.resolve(__dirname, 'node_modules/@emotion/cache'),
      '@emotion/serialize': path.resolve(__dirname, 'node_modules/@emotion/serialize'),
      '@emotion/utils': path.resolve(__dirname, 'node_modules/@emotion/utils'),
      '@emotion/sheet': path.resolve(__dirname, 'node_modules/@emotion/sheet'),
      
      // Asegura rutas absolutas desde la raíz del proyecto
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@contexts': path.resolve(__dirname, 'src/contexts'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@config': path.resolve(__dirname, 'src/config')
    },
  },
  
  // Configuración de optimización de dependencias
  optimizeDeps: {
    include: [
      'styled-components',
      'react-is',
      'stylis',
      '@emotion/unitless',
      'hoist-non-react-statics',
      'shallowequal',
      'prop-types',
      '@emotion/react',
      '@emotion/styled',
      '@emotion/cache',
      '@emotion/serialize',
      '@emotion/utils',
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'framer-motion'
    ],
    
    // Exclude componentes específicos de MUI para mejor rendimiento
    exclude: [
      '@mui/icons-material/Home',
      '@mui/icons-material/Person',
      '@mui/icons-material/Code',
      '@mui/icons-material/Chat',
      '@mui/icons-material/Science',
      '@mui/icons-material/FormatQuote',
      '@mui/icons-material/Menu',
      '@mui/icons-material/LightMode',
      '@mui/icons-material/DarkMode',
    ],
    
    // Forzar pre-bundling de dependencias específicas
    force: true
  },
  
  // Configuración de build para desarrollo (más rápida)
  build: {
    // Generar sourcemaps para debugging
    sourcemap: true,
    
    // Configuración de minificación (deshabilitada para desarrollo)
    minify: false,
    
    // Configuración de CommonJS
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/prop-types/, /node_modules/, /@emotion/]
    },
    
    // Configuración de Rollup
    rollupOptions: {
      output: {
        // Chunks manuales para mejor debugging
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-styled': ['styled-components'],
          'vendor-mui': ['@mui/material', '@mui/icons-material'],
          'vendor-emotion': ['@emotion/react', '@emotion/styled', '@emotion/cache'],
          'vendor-framer': ['framer-motion'],
          'vendor-utils': ['axios']
        }
      }
    },
    
    // Configuración de target para desarrollo
    target: 'esnext',
    
    // Configuración de chunk size warnings
    chunkSizeWarningLimit: 1000
  },
  
  // Variables de entorno específicas para desarrollo
  define: {
    __DEV__: true,
    __PROD__: false,
    'process.env.NODE_ENV': '"development"'
  },
  
  // Configuración de CSS
  css: {
    devSourcemap: true,
    preprocessorOptions: {
      scss: {
        additionalData: `@import "src/styles/variables.scss";`
      }
    }
  },
  
  // Configuración de logging
  logLevel: 'info',
  
  // Configuración de clear screen
  clearScreen: false,
  
  // Configuración de modo
  mode: 'development'
})