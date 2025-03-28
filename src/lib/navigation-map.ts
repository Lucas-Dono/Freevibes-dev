/**
 * Mapa de Navegación y Priorización de Carga
 * 
 * Este módulo define la estructura de navegación de la aplicación y 
 * asigna prioridades de carga para optimizar la experiencia del usuario.
 */
import { PageType, SectionType } from '@/services/orchestration';

// Estructura para las secciones en cada página
export interface PageStructure {
  route: string;
  sections: {
    id: SectionType;
    name: string;
    priority: number; // 1-100, mayor es más prioritario
    loadStrategy: 'eager' | 'visible' | 'lazy';
  }[];
}

// Definición de la estructura de la aplicación
export const NAVIGATION_MAP: Record<PageType, PageStructure> = {
  // Página principal
  home: {
    route: '/home',
    sections: [
      { 
        id: 'paraTi', 
        name: 'Tu Rotación Personal', 
        priority: 100,
        loadStrategy: 'eager' 
      },
      { 
        id: 'tendencias', 
        name: 'Explorá Música', 
        priority: 80,
        loadStrategy: 'visible' 
      },
      { 
        id: 'descubrimiento', 
        name: 'Zona de Descubrimiento', 
        priority: 60,
        loadStrategy: 'lazy' 
      }
    ]
  },
  
  // Página de exploración
  explore: {
    route: '/explore',
    sections: [
      { 
        id: 'tendencias', 
        name: 'Tendencias', 
        priority: 100,
        loadStrategy: 'eager' 
      },
      { 
        id: 'generos', 
        name: 'Géneros', 
        priority: 80,
        loadStrategy: 'visible' 
      },
      { 
        id: 'descubrimiento', 
        name: 'Para Descubrir', 
        priority: 60,
        loadStrategy: 'lazy' 
      }
    ]
  },
  
  // Página de biblioteca
  library: {
    route: '/library',
    sections: [
      { 
        id: 'paraTi', 
        name: 'Para Ti', 
        priority: 100,
        loadStrategy: 'eager' 
      },
      { 
        id: 'generos', 
        name: 'Tus Géneros Favoritos', 
        priority: 80,
        loadStrategy: 'visible' 
      },
      { 
        id: 'otros', 
        name: 'Historial', 
        priority: 60,
        loadStrategy: 'lazy' 
      }
    ]
  },
  
  // Página de búsqueda
  search: {
    route: '/search',
    sections: [
      { 
        id: 'tendencias', 
        name: 'Resultados de Búsqueda', 
        priority: 100,
        loadStrategy: 'eager' 
      },
      { 
        id: 'paraTi', 
        name: 'Relacionado con tu Búsqueda', 
        priority: 80,
        loadStrategy: 'visible' 
      },
      { 
        id: 'otros', 
        name: 'Similares', 
        priority: 60,
        loadStrategy: 'lazy' 
      }
    ]
  },
  
  // Página genérica para otras rutas
  otros: {
    route: '/',
    sections: [
      { 
        id: 'otros', 
        name: 'Contenido', 
        priority: 100,
        loadStrategy: 'eager' 
      }
    ]
  }
};

/**
 * Obtiene la página actual basada en la ruta
 * @param path Ruta de la página (ej: /home, /explore, etc)
 * @returns Tipo de página detectada
 */
export function getPageTypeFromPath(path: string): PageType {
  // Eliminar parámetros de la URL y normalizar
  const normalizedPath = path.split('?')[0].split('#')[0];
  const segments = normalizedPath.split('/').filter(Boolean);
  
  if (segments.length === 0) return 'home';
  
  const mainRoute = segments[0].toLowerCase();
  
  switch (mainRoute) {
    case 'home':
      return 'home';
    case 'explore':
      return 'explore';
    case 'library':
      return 'library';
    case 'search':
      return 'search';
    case 'genre':
      return 'explore'; // genre se considera parte de explore
    case 'user':
      return 'otros';
    default:
      return 'otros';
  }
}

/**
 * Obtiene las secciones para una página específica
 * @param pageType Tipo de página
 * @returns Estructura de la página con sus secciones
 */
export function getPageSections(pageType: PageType): PageStructure {
  return NAVIGATION_MAP[pageType] || NAVIGATION_MAP.otros;
}

/**
 * Determina la sección principal para una ruta específica
 * @param path Ruta de la URL
 * @returns ID de la sección principal
 */
export function getPrimarySection(path: string): SectionType {
  const pageType = getPageTypeFromPath(path);
  const sections = getPageSections(pageType).sections;
  
  // Retornar la sección con mayor prioridad
  if (sections.length > 0) {
    sections.sort((a, b) => b.priority - a.priority);
    return sections[0].id;
  }
  
  return 'otros';
}

/**
 * Convierte un string genérico a un tipo SectionType válido
 * @param section String que podría ser un SectionType
 * @returns SectionType válido o 'otros' como fallback
 */
export function asSectionType(section: string): SectionType {
  const validSections: SectionType[] = [
    'paraTi', 'tendencias', 'generos', 'descubrimiento', 'otros'
  ];
  
  return validSections.includes(section as SectionType) 
    ? (section as SectionType) 
    : 'otros';
} 