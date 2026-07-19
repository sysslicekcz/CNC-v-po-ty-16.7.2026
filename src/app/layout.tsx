import type { Metadata } from "next";
import "./globals.css";
import AppNav from "@/components/AppNav";

export const metadata: Metadata = {
  title: "CNC Časovač",
  description: "Výpočet strojních časů pro CNC obrábění",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppNav />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
