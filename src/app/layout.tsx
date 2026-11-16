import type {Metadata,Viewport} from 'next';
import Link from 'next/link';
import {BrandMark} from '@/components/ui/primitives';
import {ThemeControl} from '@/components/ui/theme-control';
import '@/styles/globals.css';
export const metadata:Metadata={title:'Onza · Pedí y recogé',description:'Demo de pedidos y retiro en barra. Pagos exclusivamente simulados.',manifest:'/manifest.webmanifest',icons:{icon:'/brand/favicon.svg',apple:'/brand/apple-touch-icon.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
const themeScript=`try{var t=localStorage.getItem('onza-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}`;
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-CR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><a className="skip" href="#main">Saltar al contenido</a><header className="header"><Link href="/" aria-label="Onza, explorar"><BrandMark/></Link><span className="demo-label">DEMO · sin dinero real</span><ThemeControl/></header><main id="main">{children}</main><nav className="bottom-nav" aria-label="Navegación principal"><Link href="/">Explorar</Link><Link href="/orders">Pedidos</Link><Link href="/login">Personal</Link></nav></body></html>}
