import { lazy, Suspense, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@fluentui/react-components'
import { AddRegular, ArrowExitRegular, ChartMultipleRegular, WalletRegular, ArrowSwapRegular, TargetArrowRegular, ArrowRepeatAllRegular, DocumentArrowUpRegular, PanelLeftContractRegular, PanelLeftExpandRegular, LeafTwoRegular } from '@fluentui/react-icons'
import { api } from './api/client'
import { useAuth } from './auth/AuthProvider'
import type { Account, Category } from './types'
import { EntityForm, type FormKind, type OpenForm } from './components/EntityForm'
import { currentMonth, ErrorMessage, IconButton, Loading } from './components/Shared'
import { AuthPage } from './pages/AuthPage'
import { Transactions } from './features/transactions/Transactions'
import { Accounts, Budgets, RecurringPage } from './features/accounts/Management'
import { Imports } from './features/imports/Imports'
import type { FieldValues } from 'react-hook-form'

const Dashboard = lazy(() => import('./features/dashboard/Dashboard').then(module => ({ default: module.Dashboard })))

const links = [
  { path: '/', label: 'Overview', icon: <ChartMultipleRegular /> },
  { path: '/transactions', label: 'Transactions', icon: <ArrowSwapRegular /> },
  { path: '/accounts', label: 'Accounts', icon: <WalletRegular /> },
  { path: '/budgets', label: 'Budgets', icon: <TargetArrowRegular /> },
  { path: '/recurring', label: 'Recurring', icon: <ArrowRepeatAllRegular /> },
  { path: '/imports', label: 'Import CSV', icon: <DocumentArrowUpRegular /> },
]

export default function App() {
  const { user, loading, logout } = useAuth()
  const [month, setMonth] = useState(currentMonth())
  const [menuOpen, setMenuOpen] = useState(false)
  const [form, setForm] = useState<{ kind: FormKind; existing?: FieldValues } | null>(null)
  const [logoutError, setLogoutError] = useState('')
  const location = useLocation()
  const accounts = useQuery({ queryKey: ['accounts'], queryFn: () => api<Account[]>('/accounts'), enabled: !!user })
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories'), enabled: !!user })
  if (loading) return <Loading />
  if (!user) return <AuthPage />
  const openForm: OpenForm = (kind, existing) => setForm({ kind, existing })
  const shared = { accounts: accounts.data ?? [], categories: categories.data ?? [], month, openForm }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <NavLink to="/" className="brand">
          <span className="brand-symbol"><LeafTwoRegular /></span>ledger<span className="brand-dot">.</span>
        </NavLink>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(link => (
            <NavLink key={link.path} to={link.path} end={link.path === '/'} onClick={() => setMenuOpen(false)}>
              {link.icon}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className="avatar">{user.email.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>Personal account</strong>
              <small title={user.email}>{user.email}</small>
            </div>
          </div>
          <Button
            appearance="subtle"
            icon={<ArrowExitRegular />}
            onClick={() => { void logout().catch(error => setLogoutError(error.message)) }}
          >
            Sign out
          </Button>
        </div>
      </aside>

      {menuOpen && <button className="menu-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span className="mobile-toggle">
              <IconButton
                label="Toggle navigation"
                icon={menuOpen ? <PanelLeftContractRegular /> : <PanelLeftExpandRegular />}
                onClick={() => setMenuOpen(!menuOpen)}
              />
            </span>
            <span>Workspace</span>
            <span>/</span>
            <strong>{links.find(link => link.path === location.pathname)?.label ?? 'Overview'}</strong>
          </div>
          <span className="currency-tag">{user.currency}<span className="status-dot" /></span>
        </header>

        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">YOUR MONEY, IN FOCUS</p>
              <h1>{location.pathname === '/' ? 'Financial overview' : links.find(link => link.path === location.pathname)?.label ?? 'Overview'}</h1>
            </div>
            <div className="heading-actions">
              {['/', '/budgets'].includes(location.pathname) && (
                <input
                  aria-label="Reporting month"
                  type="month"
                  value={month}
                  onChange={event => { if (event.target.value) setMonth(event.target.value) }}
                  min="2000-01"
                  max="2100-12"
                />
              )}
              <Button appearance="primary" icon={<AddRegular />} onClick={() => openForm('transactions')}>
                Add transaction
              </Button>
            </div>
          </div>

          {logoutError && <ErrorMessage message={logoutError} />}
          {(accounts.error || categories.error) && <ErrorMessage message={(accounts.error ?? categories.error)!.message} />}

          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Dashboard {...shared} />} />
              <Route path="/transactions" element={<Transactions {...shared} />} />
              <Route path="/accounts" element={<Accounts {...shared} />} />
              <Route path="/budgets" element={<Budgets {...shared} />} />
              <Route path="/recurring" element={<RecurringPage {...shared} />} />
              <Route path="/imports" element={<Imports accounts={shared.accounts} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          <footer>Ledger <span>Personal finance, thoughtfully organized.</span></footer>
        </main>
      </div>

      {form && <EntityForm {...form} {...shared} onClose={() => setForm(null)} />}
    </div>
  )
}
