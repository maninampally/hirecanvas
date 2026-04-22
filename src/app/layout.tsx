import type { Metadata } from "next";
import { Manrope, Sora } from 'next/font/google'
import { Toaster } from 'sonner'
import "./globals.css";

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://hirecanvas.in'),
  title: {
    default: 'HireCanvas - Job Search Command Center',
    template: '%s | HireCanvas',
  },
  description: 'Track job applications, sync Gmail, and manage your entire pipeline with AI extraction',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'HireCanvas - Job Search Command Center',
    description: 'Track job applications, sync Gmail, and manage your entire pipeline with AI extraction',
    type: 'website',
    url: '/',
    siteName: 'HireCanvas',
    images: [
      {
        url: '/og.svg',
        width: 1200,
        height: 630,
        alt: 'HireCanvas dashboard preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HireCanvas - Job Search Command Center',
    description: 'Track job applications, sync Gmail, and manage your pipeline with AI extraction.',
    images: ['/og.svg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${manrope.variable} ${sora.variable}`}
    >
      <body className="min-h-full flex flex-col bg-[#f0fdfb] font-sans">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
