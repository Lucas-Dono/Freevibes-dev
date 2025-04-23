'use client';

import React from 'react';
import AuthRequired from '@/components/AuthRequired';

export default function HomeLayout({
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
