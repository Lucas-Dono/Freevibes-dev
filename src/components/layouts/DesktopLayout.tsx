import React from 'react';
import ClientLayout from '../ClientLayout';

// DesktopLayout se encarga de renderizar la UI de escritorio sin cambios
export const DesktopLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ClientLayout>{children}</ClientLayout>;
}; 