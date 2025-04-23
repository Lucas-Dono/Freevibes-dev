'use client';

import React from 'react';
import AuthRequired from '@/components/AuthRequired';

export default function ProfileLayout({
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
