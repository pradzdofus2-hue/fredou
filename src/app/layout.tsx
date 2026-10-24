import type { Metadata } from 'next';
import { GameApp } from '@/components/game-app';
import './globals.css';
import '@/components/shell.css';
import '@/components/pages.css';
export const metadata: Metadata = { title: 'Krosmoria — Un monde à collectionner', description: 'Ouvrez des boosters, explorez trois univers originaux et partagez votre passion de la collection.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr" data-scroll-behavior="smooth"><body><GameApp />{children}</body></html>; }
