import React from 'react';
import { NextPage, NextPageContext } from 'next';
import Head from 'next/head';

interface ErrorProps {
  statusCode?: number;
}

const Error: NextPage<ErrorProps> = ({ statusCode }) => {
  return (
    <>
      <Head>
        <title>{statusCode ? `Error ${statusCode}` : 'Error'} | MusicPlayer</title>
      </Head>
      
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-white p-4">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold mb-4">
            {statusCode === 404 ? 'Página no encontrada' : 'Ha ocurrido un error'}
          </h1>
          
          <p className="text-lg mb-6">
            {statusCode === 404
              ? 'La página que estás buscando no existe o ha sido movida.'
              : 'Ha ocurrido un error en el servidor. Por favor, inténtalo de nuevo más tarde.'}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 transition-colors rounded-lg text-white"
            >
              Volver al inicio
            </a>
            
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 transition-colors rounded-lg text-white"
            >
              Volver atrás
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

Error.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
  const statusCode = res ? res.statusCode : err ? (err as any).statusCode : 404;
  return { statusCode };
};

export default Error; 