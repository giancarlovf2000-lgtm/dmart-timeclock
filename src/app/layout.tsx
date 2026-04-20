import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({ src: "./fonts/GeistVF.woff", variable: "--font-sans", weight: "100 900" });

export const metadata: Metadata = {
  title: "D'mart Institute",
  description: "Sistema de ponchadores D'mart Institute",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={geist.variable}>
      <body className="font-sans antialiased bg-zinc-950 text-white">
        {children}
      </body>
    </html>
  );
}
