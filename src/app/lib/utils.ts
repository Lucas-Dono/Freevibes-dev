import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina múltiples clases de Tailwind usando clsx y tailwind-merge
 * para evitar conflictos de clases
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una duración en milisegundos a formato mm:ss
 */
export function formatDuration(ms: number): string {
  if (!ms) return '0:00';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Crea un retraso utilizando Promesas
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Genera un ID único basado en timestamp y random
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Obtiene una versión resumida de un texto largo
 */
export function truncateText(text: string, length: number = 100): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trim() + '...';
}

/**
 * Extrae el color dominante de una imagen (simulado para este ejemplo)
 */
export function getDominantColor(): string {
  // Esto sería reemplazado por una implementación real que analiza la imagen
  const colors = [
    '#7C3AED', // Violeta
    '#8B5CF6', // Violeta claro
    '#EC4899', // Rosa
    '#06B6D4', // Turquesa
    '#3B82F6', // Azul
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Convierte una string a kebab-case
 * Ejemplo: "Hello World" -> "hello-world"
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
}
