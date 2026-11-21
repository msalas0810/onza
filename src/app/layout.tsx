import type { Metadata, Viewport } from "next";
import { AppHeader, CustomerNavigation } from "@/components/ui/navigation";
import { AuthSync } from "@/components/ui/auth-sync";
import { CartScope } from "@/features/orders/components/cart-scope";
import { currentUserId } from "@/lib/session-user";
import "@/styles/globals.css";
export const metadata: Metadata = {
  title: "Onza · Pedí y recogé",
  description:
    "Demo de pedidos y retiro en barra. Pagos exclusivamente simulados.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/favicon.svg", apple: "/brand/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
const themeScript = `try{var t=localStorage.getItem('onza-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}`;
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await currentUserId();
  return (
    <html lang="es-CR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Saltar al contenido
        </a>
        <CartScope userId={userId} />
        <AuthSync userId={userId} />
        <AppHeader />
        <main id="main">{children}</main>
        <CustomerNavigation />
      </body>
    </html>
  );
}
