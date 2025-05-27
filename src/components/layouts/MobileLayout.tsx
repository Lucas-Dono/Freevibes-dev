import React from 'react';
import ClientLayout from '../ClientLayout';
import MobileHeader from '../mobile/MobileHeader';
import { MobilePlayerBar } from '../player/MobilePlayerBar';
import MobileNavBar from '../mobile/MobileNavBar';
import './mobile-styles.css';

// MobileLayout: estructura para dispositivos móviles con header, contenido scrollable y footer fijo
export const MobileLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ClientLayout noNavAndFooter>
      <div className="mobile-layout flex flex-col min-h-screen">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto pb-16 pt-14 mt-2">
          <div className="mobile-content-wrapper">
            {children}
          </div>
        </main>
        <MobilePlayerBar />
        <MobileNavBar />
      </div>
    </ClientLayout>
  );
}; 