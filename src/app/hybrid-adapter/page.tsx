'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Configuración de dinámica para evitar prerender estático
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default function HybridAdapter() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir a la página Pages Router
    window.location.href = '/hybrid';
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
      <h1 className="text-xl">Cargando el reproductor híbrido...</h1>
    </div>
  );
}
