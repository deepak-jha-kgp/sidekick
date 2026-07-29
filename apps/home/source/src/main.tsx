import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthGuard } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import Root from './app'
import './styles.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGuard client={lemmaClient} loadingFallback={<div className="boot">Checking access…</div>}>
        <Root />
      </AuthGuard>
    </QueryClientProvider>
  </React.StrictMode>,
)
