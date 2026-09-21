import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ModuleAccessProvider } from '@/app/components/ModuleAccessProvider'
import FeatureAccessController from './components/FeatureAccessController'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tynato CRM",
  description: "Tynato CRM sales workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
return (
  <html lang="en">
    <body className="min-h-full flex flex-col">
  <FeatureAccessController>
    {children}
  </FeatureAccessController>
</body>
  </html>
);
}
