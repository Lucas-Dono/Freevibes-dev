'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Componente de redirección - sirve como punto de entrada para la ruta /hybrid
 * Redirige al usuario a la página del App Router que implementa la funcionalidad
 */
export default function HybridAdapter() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir a la implementación en App Router
    router.push('/hybrid');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto mb-4"></div>
        <p className="text-xl">Redirigiendo al reproductor híbrido...</p>
      </div>
    </div>
  );
}
