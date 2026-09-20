import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ login: vi.fn() }) }))
describe('Authentication forms', () => {
  it('switches to registration and displays validation without sending a request', async () => {
    render(<FluentProvider theme={webLightTheme}><QueryClientProvider client={new QueryClient()}><AuthPage /></QueryClientProvider></FluentProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByLabelText('Reporting currency')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email address'), 'person@example.com')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: /^Create account$/ }))
    expect(await screen.findByText('Use at least 12 characters')).toBeInTheDocument()
  })
})