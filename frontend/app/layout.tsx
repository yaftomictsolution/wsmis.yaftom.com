import '@daypicker/react/style.css'
import './globals.css'
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;var t=localStorage.getItem('theme');var n=t==='light'||t==='dark'?t:'light';var l=localStorage.getItem('language');var g=l==='fa'?'fa':'en';d.classList.remove('light','dark');d.classList.add(n);d.lang=g==='fa'?'fa-AF':'en';d.dir=g==='fa'?'rtl':'ltr';})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
