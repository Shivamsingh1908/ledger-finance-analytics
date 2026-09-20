import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import '@fontsource-variable/manrope'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import './styles/index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } })
const theme = { ...webLightTheme, fontFamilyBase: '"DM Sans", sans-serif', colorBrandBackground: '#087f70', colorBrandBackgroundHover: '#07695d', colorBrandBackgroundPressed: '#06564c', colorBrandForeground1: '#087f70', colorCompoundBrandBackground: '#087f70', colorCompoundBrandStroke: '#087f70' }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={theme}><QueryClientProvider client={client}><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></QueryClientProvider></FluentProvider>
  </StrictMode>,
)
