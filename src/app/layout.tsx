import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import "./globals.css";

// Tipografías (OFL) alojadas en el proyecto: sin dependencia de Google Fonts.
// Young Serif: rótulo de carta de bistró, para el nombre, las horas y los números de mesa.
const rotulo = localFont({
  src: "./fuentes/young-serif-latin-400-normal.woff2",
  variable: "--font-rotulo",
  weight: "400",
  display: "swap",
});
// Instrument Sans: texto de trabajo, legible en pantallas pequeñas.
const texto = localFont({
  src: "./fuentes/instrument-sans-latin-wght-normal.woff2",
  variable: "--font-texto",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mesa · La Ceiba",
  description: "Reservas en línea y gestión de mesas en vivo para restaurantes: plano del salón, lista de espera con tiempo estimado y control de ausencias.",
};

export const viewport: Viewport = { themeColor: "#2a1118" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render dinámico: la CSP lleva un nonce nuevo en cada petición (ver src/proxy.ts).
  await connection();
  return (
    <html lang="es" className={`${rotulo.variable} ${texto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
