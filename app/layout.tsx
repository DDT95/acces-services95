import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Services essentiels & accessibilité · Val-d’Oise",
  description: "Carte des services publics et essentiels du Val-d’Oise, horaires, contacts et isochrones piéton et voiture.",
  openGraph: {
    title: "Services essentiels & accessibilité · Val-d’Oise",
    description: "15 386 lieux réunis sur une carte : services publics, santé, écoles, mobilités, horaires, contacts et temps d’accès.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Services essentiels et accessibilité dans le Val-d’Oise" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Services essentiels & accessibilité · Val-d’Oise",
    description: "Services, horaires, contacts et isochrones à pied ou en voiture.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
