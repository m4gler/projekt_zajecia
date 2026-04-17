import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "CAD Assembly Upload",
  description: "Pierwszy etap aplikacji do generowania instrukcji montażu z plików STEP/STP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="font-[family-name:var(--font-sans)] antialiased">{children}</body>
    </html>
  );
}
