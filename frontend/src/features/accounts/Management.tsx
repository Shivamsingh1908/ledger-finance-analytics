import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Switch } from '@fluentui/react-components'
import { AddRegular, EditRegular, DeleteRegular, WalletRegular, ArrowRepeatAllRegular } from '@fluentui/react-icons'
import { api, save } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import type { Account, Category, Budget, Recurring } from '../../types'
import type { OpenForm } from '../../components/EntityForm'
import { Confirm, dateLabel, Empty, ErrorMessage, IconButton, Loading, money } from '../../components/Shared'

interface Props { accounts: Account[]; categories: Category[]; month: string; openForm: OpenForm }
export function Accounts({ accounts, categories, openForm }: Props) {
  const [deleting, setDeleting] = useState<Account | null>(null)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const remove = useMutation({ mutationFn: (id: string) => api(`/accounts/${id}`, { method: 'DELETE' }), onSuccess: async () => { setDeleting(null); await queryClient.invalidateQueries() } })
  return <><section><div className="section-heading"><div><h2>Your accounts</h2><p>Total balance <strong>{money(accounts.reduce((total, account) => total + account.balance, 0), user?.currency)}</strong></p></div><Button icon={<AddRegular />} onClick={() => openForm('accounts')}>New account</Button></div>
    <div className="account-grid">{accounts.map(account => <article className="account-card" key={account.id}><div className="account-top"><span className="account-icon"><WalletRegular /></span><span className="tag">{account.type}</span><div className="row-actions"><IconButton label={`Edit ${account.name}`} icon={<EditRegular />} onClick={() => openForm('accounts', account)} /><IconButton label={`Delete ${account.name}`} icon={<DeleteRegular />} onClick={() => { remove.reset(); setDeleting(account) }} /></div></div><h3>{account.name}</h3><strong className="account-balance">{money(account.balance, account.currency)}</strong><div className="account-foot"><span>Opening balance</span><span>{money(account.openingBalance, account.currency)}</span></div></article>)}</div>
    {!accounts.length && <Empty title="No accounts yet" />}</section>
    <section className="category-section"><div className="section-heading"><div><h2>Categories</h2><p>Your income and expense groups</p></div><Button icon={<AddRegular />} onClick={() => openForm('categories')}>New category</Button></div><div className="category-grid">{categories.map(category => <div className="category-item" key={category.id}><i className="category-swatch" style={{ background: category.color }} /><strong>{category.name}</strong><span className="muted">{category.type}</span></div>)}</div></section>
    {deleting && <Confirm title={`Delete ${deleting.name}?`} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} pending={remove.isPending} error={remove.error?.message} />}</>
}

export function Budgets({ categories, month, openForm }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState<Budget | null>(null)
  const query = useQuery({ queryKey: ['budgets', month], queryFn: () => api<Budget[]>(`/budgets?month=${month}`) })
  const remove = useMutation({ mutationFn: (id: string) => api(`/budgets/${id}`, { method: 'DELETE' }), onSuccess: async () => { setDeleting(null); await queryClient.invalidateQueries() } })
  return <section><div className="section-heading"><div><h2>Monthly spending limits</h2><p>{query.data?.length ?? 0} categories budgeted</p></div><Button icon={<AddRegular />} onClick={() => openForm('budgets')}>New budget</Button></div>
    {query.isPending ? <Loading /> : query.error ? <ErrorMessage message={query.error.message} /> : <div className="budget-grid">{query.data!.map(budget => {
      const category = categories.find(item => item.id === budget.categoryId)
      const over = budget.spent > budget.limit
      return <article className="budget-card" key={budget.id}><div className="section-heading"><h3><i className="dot" style={{ background: category?.color }} />{category?.name}</h3><div className="row-actions"><IconButton label={`Edit ${category?.name} budget`} icon={<EditRegular />} onClick={() => openForm('budgets', budget)} /><IconButton label={`Delete ${category?.name} budget`} icon={<DeleteRegular />} onClick={() => { remove.reset(); setDeleting(budget) }} /></div></div><div className="budget-amount"><strong>{money(budget.spent, user?.currency)}</strong><span>of {money(budget.limit, user?.currency)}</span></div><progress className={over ? 'over' : ''} max={budget.limit} value={Math.min(budget.spent, budget.limit)} /><div className={`budget-remaining ${over ? 'negative' : ''}`}>{money(Math.abs(budget.limit - budget.spent), user?.currency)} {over ? 'over budget' : 'remaining'}<span>{Math.round(budget.spent / budget.limit * 100)}%</span></div></article>
    })}</div>}
    {query.data?.length === 0 && <Empty title="A fresh month, a fresh plan" action={<Button icon={<AddRegular />} onClick={() => openForm('budgets')}>Set your first budget</Button>} />}
    {deleting && <Confirm title="Delete this budget?" onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} pending={remove.isPending} error={remove.error?.message} />}
  </section>
}

export function RecurringPage({ accounts, categories, openForm }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['recurring'], queryFn: () => api<Recurring[]>('/recurring') })
  const toggle = useMutation({ mutationFn: (rule: Recurring) => save(`/recurring/${rule.id}`, { ...rule, isActive: !rule.isActive }, 'PUT'), onSuccess: () => queryClient.invalidateQueries() })
  return <section><div className="section-heading"><div><h2>On the calendar</h2><p>{query.data?.filter(rule => rule.isActive).length ?? 0} active recurring transactions</p></div><Button icon={<AddRegular />} onClick={() => openForm('recurring')}>New recurring</Button></div>
    {toggle.error && <ErrorMessage message={toggle.error.message} />}
    {query.isPending ? <Loading /> : query.error ? <ErrorMessage message={query.error.message} /> : <div className="recurring-list">{query.data!.map(rule => <article className="recurring-row" key={rule.id}><span className="recurring-icon"><ArrowRepeatAllRegular /></span><div className="recurring-description"><h3>{rule.description}</h3><small>{categories.find(category => category.id === rule.categoryId)?.name} / {accounts.find(account => account.id === rule.accountId)?.name}</small></div><div><strong className={rule.type === 'Income' ? 'positive' : ''}>{rule.type === 'Income' ? '+' : '-'}{money(rule.amount, user?.currency)}</strong><small>{rule.frequency}</small></div><div><span>{dateLabel(rule.nextOccurrence)}</span><small>Next occurrence</small></div><Switch checked={rule.isActive} label={rule.isActive ? 'Active' : 'Paused'} disabled={toggle.isPending} onChange={() => toggle.mutate(rule)} /><IconButton label={`Edit ${rule.description}`} icon={<EditRegular />} onClick={() => openForm('recurring', rule)} /></article>)}</div>}
    {query.data?.length === 0 && <Empty title="Nothing on repeat yet" action={<Button icon={<AddRegular />} onClick={() => openForm('recurring')}>Add recurring transaction</Button>} />}
  </section>
}