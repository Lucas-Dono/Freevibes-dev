import "./globals.css";
import { Inter } from "next/font/google";
import ClientLayout from '@/components/ClientLayout';
import { PlayerProvider } from '@/contexts/PlayerContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'MusicVerse',
  description: 'Reproductor de música integrado con YouTube',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <PlayerProvider>
          <ClientLayout>{children}</ClientLayout>
        </PlayerProvider>
      </body>
    </html>
  );
} 