export default function HybridLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}

// Forzar a que esta ruta sea dinámica
export const dynamic = 'force-dynamic';
