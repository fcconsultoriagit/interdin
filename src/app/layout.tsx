import type { Metadata } from "next";
import { Montserrat, Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const montserratInstitutional = Montserrat({
  variable: "--font-montserrat-institutional",
  subsets: ["latin"],
  weight: "600",
});

export const metadata: Metadata = {
  title: "Perfis e permissões | Interdin",
  description: "Gerencie perfis de acesso e permissões da plataforma Interdin.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${publicSans.variable} ${montserratInstitutional.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
