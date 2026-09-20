import { useDeferredValue, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@fluentui/react-components'
import { EditRegular, DeleteRegular, ChevronLeftRegular, ChevronRightRegular, SearchRegular, ArrowDownLeftRegular, ArrowUpRightRegular, ArrowDownloadRegular } from '@fluentui/react-icons'
import { format, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns'
import { api, downloadFile } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import type { Account, Category, Transaction, PageResult } from '../../types'
import type { OpenForm } from '../../components/EntityForm'
import { Confirm, dateLabel, Empty, ErrorMessage, IconButton, Loading, money } from '../../components/Shared'

export function TransactionTable({ entries, accounts, categories, compact, onEdit, onDelete }: { entries: Transaction[]; accounts: Account[]; categories: Category[]; compact?: boolean; onEdit?: (entry: Transaction) => void; onDelete?: (entry: Transaction) => void }) {
  const { user } = useAuth()
  if (!entries.length) return null
  return <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Category</th>{!compact && <th>Account</th>}<th>Date</th><th className="numeric">Amount</th>{!compact && <th><span className="sr-only">Actions</span></th>}</tr></thead><tbody>{entries.map(entry => {
    const category = categories.find(item => item.id === entry.categoryId)
    return <tr key={entry.id}><td><div className="transaction-name"><span className={`transaction-symbol ${entry.type === 'Income' ? 'income' : ''}`}>{entry.type === 'Income' ? <ArrowDownLeftRegular /> : <ArrowUpRightRegular />}</span><strong>{entry.description}</strong></div></td><td><span className="category-label"><i className="dot" style={{ background: category?.color }} />{category?.name ?? 'Category'}</span></td>{!compact && <td>{accounts.find(account => account.id === entry.accountId)?.name}</td>}<td className="nowrap">{dateLabel(entry.transactionDate)}</td><td className={`numeric amount ${entry.type === 'Income' ? 'positive' : ''}`}>{entry.type === 'Income' ? '+' : '-'}{money(entry.amount, user?.currency)}</td>{!compact && <td><div className="row-actions"><IconButton label={`Edit ${entry.description}`} icon={<EditRegular />} onClick={() => onEdit?.(entry)} /><IconButton label={`Delete ${entry.description}`} icon={<DeleteRegular />} onClick={() => onDelete?.(entry)} /></div></td>}</tr>
  })}</tbody></table></div>
}

export function Transactions({ accounts, categories, openForm }: { accounts: Account[]; categories: Category[]; openForm: OpenForm }) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [type, setType] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [range, setRange] = useState('')
  const [sort, setSort] = useState('transactionDate:desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const queryClient = useQueryClient()
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sortBy: sort.split(':')[0], sortDirection: sort.split(':')[1] })
  if (deferredSearch) params.set('search', deferredSearch)
  if (type) params.set('type', type)
  if (categoryId) params.set('categoryId', categoryId)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = useQuery({ queryKey: ['transactions', params.toString()], queryFn: () => api<PageResult<Transaction>>(`/transactions?${params}`), placeholderData: keepPreviousData })
  const remove = useMutation({ mutationFn: (id: string) => api(`/transactions/${id}`, { method: 'DELETE' }), onSuccess: async () => { setDeleting(null); setPage(1); await queryClient.invalidateQueries() } })
  function applyRange(value: string) {
    setRange(value); setPage(1)
    const now = new Date()
    if (value === 'month') { setFrom(format(startOfMonth(now), 'yyyy-MM-dd')); setTo(format(endOfMonth(now), 'yyyy-MM-dd')) }
    else if (value === '30') { setFrom(format(subDays(now, 29), 'yyyy-MM-dd')); setTo(format(now, 'yyyy-MM-dd')) }
    else if (value === 'year') { setFrom(format(startOfYear(now), 'yyyy-MM-dd')); setTo(format(endOfYear(now), 'yyyy-MM-dd')) }
    else { setFrom(''); setTo('') }
  }
  return <section><div className="filters"><label className="search-input"><SearchRegular /><input aria-label="Search transactions" placeholder="Search transactions..." value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
    <select aria-label="Filter by type" value={type} onChange={event => { setType(event.target.value); setPage(1) }}><option value="">All types</option><option>Income</option><option>Expense</option></select>
    <select aria-label="Filter by category" value={categoryId} onChange={event => { setCategoryId(event.target.value); setPage(1) }}><option value="">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
    <select aria-label="Sort transactions" value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}><option value="transactionDate:desc">Newest first</option><option value="transactionDate:asc">Oldest first</option><option value="amount:desc">Highest amount</option><option value="amount:asc">Lowest amount</option><option value="description:asc">Description A-Z</option></select>
    <select aria-label="Quick date range" value={range} onChange={event => applyRange(event.target.value)}><option value="">All time</option><option value="month">This month</option><option value="30">Last 30 days</option><option value="year">This year</option></select>
    <label className="date-filter">From<input aria-label="From date" type="date" value={from} onChange={event => { setFrom(event.target.value); setRange(''); setPage(1) }} /></label><label className="date-filter">To<input aria-label="To date" type="date" value={to} onChange={event => { setTo(event.target.value); setRange(''); setPage(1) }} /></label>
    {(search || type || categoryId || from || to) && <Button appearance="transparent" onClick={() => { setSearch(''); setType(''); setCategoryId(''); setFrom(''); setTo(''); setRange(''); setPage(1) }}>Clear filters</Button>}
    <Button className="export-button" appearance="subtle" icon={<ArrowDownloadRegular />} disabled={!query.data?.total} onClick={() => { void downloadFile(`/transactions/export?${params}`, `transactions-${new Date().toISOString().slice(0, 10)}.csv`) }}>Export CSV</Button></div>
    {query.isPending ? <Loading /> : query.error ? <ErrorMessage message={query.error.message} /> : <><TransactionTable entries={query.data!.items} accounts={accounts} categories={categories} onEdit={entry => openForm('transactions', entry)} onDelete={entry => { remove.reset(); setDeleting(entry) }} />{!query.data!.items.length && <Empty title="No transactions found" />}
      <div className="pagination"><span>{query.data!.total} transactions</span><div><select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}><option value="20">20 per page</option><option value="50">50 per page</option><option value="100">100 per page</option></select><IconButton label="Previous page" icon={<ChevronLeftRegular />} disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)} /><span>Page {page} of {Math.max(1, Math.ceil(query.data!.total / pageSize))}</span><IconButton label="Next page" icon={<ChevronRightRegular />} disabled={page * pageSize >= query.data!.total || query.isFetching} onClick={() => setPage(page + 1)} /></div></div></>}
    {deleting && <Confirm title={`Delete ${deleting.description}?`} onClose={() => setDeleting(null)} onConfirm={() => remove.mutate(deleting.id)} pending={remove.isPending} error={remove.error?.message} />}
  </section>
}