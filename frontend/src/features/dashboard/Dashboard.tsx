import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, subDays, startOfMonth, endOfMonth, startOfYear } from 'date-fns'
import { Button } from '@fluentui/react-components'
import { ArrowUpRightRegular, ArrowDownLeftRegular, WalletRegular, TargetArrowRegular, ArrowRightRegular, AddRegular } from '@fluentui/react-icons'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import type { Account, Category, Summary, Trend, Budget } from '../../types'
import { Empty, ErrorMessage, Loading, money, monthLabel } from '../../components/Shared'
import type { OpenForm } from '../../components/EntityForm'
import { TransactionTable } from '../transactions/Transactions'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)
ChartJS.defaults.font.family = 'DM Sans'
ChartJS.defaults.color = '#707a78'

export function Dashboard({ accounts, categories, month, openForm }: { accounts: Account[]; categories: Category[]; month: string; openForm: OpenForm }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [period, setPeriod] = useState('month')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [type, setType] = useState('')
  const now = new Date()
  const monthDate = parseISO(`${month}-01`)
  const range = period === '30' ? { from: subDays(now, 29), to: now }
    : period === '90' ? { from: subDays(now, 89), to: now }
    : period === 'year' ? { from: startOfYear(now), to: now }
    : { from: startOfMonth(monthDate), to: endOfMonth(monthDate) }
  const filters = new URLSearchParams()
  if (period === 'month') filters.set('month', month)
  else { filters.set('from', format(range.from, 'yyyy-MM-dd')); filters.set('to', format(range.to, 'yyyy-MM-dd')) }
  if (accountId) filters.set('accountId', accountId)
  if (categoryId) filters.set('categoryId', categoryId)
  if (type) filters.set('type', type)
  const qs = filters.toString()
  const periodLabel = period === '30' ? 'Last 30 days' : period === '90' ? 'Last 90 days' : period === 'year' ? 'This year' : monthLabel(month)
  const summary = useQuery({ queryKey: ['summary', qs], queryFn: () => api<Summary>(`/dashboard/summary?${qs}`), placeholderData: keepPreviousData })
  const trends = useQuery({ queryKey: ['trends', qs], queryFn: () => api<Trend[]>(`/dashboard/trends?${qs}`), placeholderData: keepPreviousData })
  const budgets = useQuery({ queryKey: ['budgets', month], queryFn: () => api<Budget[]>(`/budgets?month=${month}`) })
  if (summary.isPending || trends.isPending) return <Loading />
  if (summary.error || trends.error) return <ErrorMessage message={(summary.error ?? trends.error)!.message} />
  const data = summary.data!
  const currency = user!.currency
  const pct = (current: number, previous: number) => previous === 0 ? null : Math.round(((current - previous) / Math.abs(previous)) * 100)
  const metrics = [
    { title: 'Total income', value: money(data.income, currency), detail: periodLabel, icon: <ArrowDownLeftRegular />, tone: 'green', change: pct(data.income, data.previousIncome), goodUp: true },
    { title: 'Total expenses', value: money(data.expenses, currency), detail: `${data.transactionCount} transactions${period === 'month' ? ' this month' : ''}`, icon: <ArrowUpRightRegular />, tone: 'coral', change: pct(data.expenses, data.previousExpenses), goodUp: false },
    { title: 'Net cash flow', value: money(data.net, currency), detail: 'Income minus expenses', icon: <WalletRegular />, tone: 'blue', change: pct(data.net, data.previousNet), goodUp: true },
    { title: 'Savings rate', value: `${data.savingsRate}%`, detail: 'Of your monthly income', icon: <TargetArrowRegular />, tone: 'amber', change: null, goodUp: true },
  ]
  return <div className="dashboard">
    <div className="dashboard-filters">
      <select aria-label="Dashboard period" value={period} onChange={event => setPeriod(event.target.value)}><option value="month">This month</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="year">This year</option></select>
      <select aria-label="Filter by account" value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">All accounts</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
      <select aria-label="Filter dashboard category" value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <select aria-label="Filter dashboard type" value={type} onChange={event => setType(event.target.value)}><option value="">Income &amp; expense</option><option value="Income">Income</option><option value="Expense">Expense</option></select>
    </div>
    <section className="metric-grid" aria-label="Monthly totals">{metrics.map(metric => <article className={`metric ${metric.tone}`} key={metric.title}><div className="metric-label">{metric.title}<span className="metric-icon">{metric.icon}</span></div><strong>{metric.value}</strong><small>{metric.detail}</small>{metric.change != null && <span className={`metric-change ${(metric.change >= 0) === metric.goodUp ? 'up' : 'down'}`}>{metric.change > 0 ? '▲' : metric.change < 0 ? '▼' : '■'} {Math.abs(metric.change)}% <span>{period === 'month' ? 'vs last month' : 'vs prev period'}</span></span>}</article>)}</section>
    <div className="chart-grid"><section className="chart-section"><div className="section-heading"><div><h2>Cash flow</h2><p>Income and expenses over time</p></div><div className="chart-legend"><span><i className="dot green-dot" />Income</span><span><i className="dot pale-dot" />Expenses</span></div></div>
      <div className="bar-chart"><Bar aria-label="Six month income and expense chart" data={{ labels: trends.data!.map(trend => monthLabel(trend.month).split(' ')[0].slice(0, 3)), datasets: [
        { label: 'Income', data: trends.data!.map(trend => trend.income), backgroundColor: '#168777', borderRadius: 4, maxBarThickness: 26 },
        { label: 'Expenses', data: trends.data!.map(trend => trend.expenses), backgroundColor: '#bddbd3', borderRadius: 4, maxBarThickness: 26 },
      ] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${money(Number(context.raw), currency)}` } } }, scales: { x: { grid: { display: false }, border: { display: false } }, y: { beginAtZero: true, border: { display: false }, grid: { color: '#edf0ed' }, ticks: { maxTicksLimit: 5 } } } }} /></div>
    </section><section className="chart-section spending"><div className="section-heading"><div><h2>Spending breakdown</h2><p>Where your money went</p></div></div>
      {data.byCategory.length ? <><div className="donut-wrap"><Doughnut aria-label="Spending by category" data={{ labels: data.byCategory.map(category => category.name), datasets: [{ data: data.byCategory.map(category => category.amount), backgroundColor: data.byCategory.map(category => category.color), borderWidth: 4, borderColor: '#fff', hoverOffset: 3 }] }} options={{ maintainAspectRatio: false, cutout: '76%', plugins: { legend: { display: false } } }} /><div className="donut-label"><small>Total spent</small><strong>{money(data.expenses, currency)}</strong></div></div><div className="category-legend">{data.byCategory.map(category => <div key={category.categoryId}><span><i className="dot" style={{ background: category.color }} />{category.name}</span><strong>{money(category.amount, currency)}</strong></div>)}</div></> : <Empty title="No expenses this month" />}
    </section></div>
    <div className="dashboard-bottom"><section className="recent-section"><div className="section-heading"><div><h2>Recent transactions</h2><p>Your latest activity</p></div><Button onClick={() => navigate('/transactions')} appearance="transparent" icon={<ArrowRightRegular />} iconPosition="after">View all</Button></div>
      <TransactionTable entries={data.recent} accounts={accounts} categories={categories} compact />
      {!data.recent.length && <Empty title="Your ledger is ready" action={<Button icon={<AddRegular />} onClick={() => openForm('transactions')}>Add your first transaction</Button>} />}
    </section><section className="budget-overview"><div className="section-heading"><div><h2>Monthly budgets</h2><p>A little room for what matters</p></div><Button onClick={() => navigate('/budgets')} appearance="transparent" icon={<ArrowRightRegular />} aria-label="View budgets" /></div>
      {budgets.error && <ErrorMessage message={budgets.error.message} />}
      {budgets.data?.length ? budgets.data.slice(0, 4).map(budget => <div className="mini-budget" key={budget.id}><div><strong>{categories.find(category => category.id === budget.categoryId)?.name}</strong><span>{Math.round(budget.spent / budget.limit * 100)}%</span></div><progress className={budget.spent > budget.limit ? 'over' : ''} max={budget.limit} value={Math.min(budget.spent, budget.limit)} /><small>{money(budget.spent, currency)} <span>of {money(budget.limit, currency)}</span></small></div>) : <Empty title="No budgets for this month" action={<Button onClick={() => openForm('budgets')} icon={<AddRegular />}>Set a budget</Button>} />}
    </section></div>
  </div>
}