import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fraunces (OFL), alojada en el proyecto: sin dependencia de Google Fonts.
const titulos = localFont({
  src: "./fuentes/fraunces-latin-opsz-normal.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mesa · La Ceiba",
  description: "Reservas en línea y gestión de mesas en vivo para restaurantes: plano del salón, lista de espera con tiempo estimado y control de ausencias.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={titulos.variable}>
      <body>{children}</body>
    </html>
  );
}
