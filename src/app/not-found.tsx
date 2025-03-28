export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <h1 className="text-4xl font-bold text-white mb-4">404</h1>
      <h2 className="text-2xl text-white mb-6">Página no encontrada</h2>
      <p className="text-gray-400 mb-8">
        Lo sentimos, la página que estás buscando no existe o ha sido movida.
      </p>
      <a 
        href="/" 
        className="bg-primary hover:bg-primary/90 text-white font-medium py-2 px-6 rounded-full transition-colors"
      >
        Volver a inicio
      </a>
    </div>
  );
} 