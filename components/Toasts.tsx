'use client';

import { Toaster } from 'sonner';

export function Toasts() {
  return <Toaster position="top-right" theme="dark" toastOptions={{ style: { background: '#14171c', color: '#fff', border: '1px solid #474d57', borderRadius: '2px', fontFamily: 'inherit' } }} />;
}
