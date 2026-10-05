import type { Metadata } from "next";
import { Montserrat, Public_Sans } from "next/font/google";
import "./globals.css";
import { obterSessaoAtual } from "@/lib/auth";
import { AuthPermissionsProvider } from "@/hooks/useAuthPermissions";

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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await obterSessaoAtual();

  return (
    <html
      lang="pt-BR"
      className={`${publicSans.variable} ${montserratInstitutional.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthPermissionsProvider user={user}>{children}</AuthPermissionsProvider>
      </body>
    </html>
  );
}
