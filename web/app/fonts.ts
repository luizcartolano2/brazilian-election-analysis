import localFont from 'next/font/local'

// The packages' Latin files, which cover Portuguese, served from the app's own origin.
export const archivo = localFont({
  src: '../node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-archivo',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

export const publicSans = localFont({
  src: '../node_modules/@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-public-sans',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

export const FONT_VARIABLES = `${archivo.variable} ${publicSans.variable}`
