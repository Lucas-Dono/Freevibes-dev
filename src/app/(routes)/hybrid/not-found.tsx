'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white">
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold mb-4 text-emerald-400">404 - Página no encontrada</h1>
        <p className="text-xl mb-8">La página de recomendaciones híbridas que buscas no existe.</p>
        <Link 
          href="/" 
          className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
} 