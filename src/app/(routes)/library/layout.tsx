'use client';

import React from 'react';
import AuthRequired from '@/components/AuthRequired';

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthRequired>
      {children}
    </AuthRequired>
  );
} 