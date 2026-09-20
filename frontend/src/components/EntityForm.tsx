import { useEffect, useState } from 'react'
import { useForm, type FieldValues, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@fluentui/react-components'
import { save } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { accountSchema, budgetSchema, categorySchema, recurringSchema, transactionSchema } from '../validation/forms'
import type { Account, Category } from '../types'
import { ErrorMessage, Modal, today } from './Shared'

export type FormKind = 'transactions' | 'accounts' | 'categories' | 'budgets' | 'recurring'
export type OpenForm = (kind: FormKind, existing?: FieldValues) => void
const titles = { transactions: 'transaction', accounts: 'account', categories: 'category', budgets: 'budget', recurring: 'recurring transaction' }
export function EntityForm({ kind, existing, accounts, categories, month, onClose }: {
  kind: FormKind; existing?: FieldValues; accounts: Account[]; categories: Category[]; month: string; onClose: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [type, setType] = useState(existing?.type ?? 'Expense')
  const schemas = { transactions: transactionSchema, accounts: accountSchema, categories: categorySchema, budgets: budgetSchema, recurring: recurringSchema }
  const defaults = {
    transactions: { accountId: accounts[0]?.id ?? '', categoryId: '', type: 'Expense', amount: 0, description: '', transactionDate: today() },
    recurring: { accountId: accounts[0]?.id ?? '', categoryId: '', type: 'Expense', amount: 0, description: '', frequency: 'Monthly', nextOccurrence: today(), isActive: true },
    accounts: { name: '', type: 'Checking', openingBalance: 0, currency: user?.currency ?? 'USD' },
    categories: { name: '', type: 'Expense', color: '#087f70' },
    budgets: { categoryId: '', month, limit: 0 },
  }
  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<FieldValues>({
    resolver: zodResolver(schemas[kind]) as unknown as Resolver<FieldValues>,
    defaultValues: existing ? { ...existing, month: existing.month?.slice(0, 7) } : defaults[kind],
  })
  useEffect(() => {
    if (!existing && (kind === 'transactions' || kind === 'recurring') && accounts[0] && !getValues('accountId')) {
      setValue('accountId', accounts[0].id)
    }
  }, [accounts, existing, kind, getValues, setValue])
  const mutation = useMutation({ mutationFn: (values: FieldValues) => save(`/${kind}${existing ? `/${existing.id}` : ''}`, values, existing ? 'PUT' : 'POST'),
    onSuccess: async () => { await queryClient.invalidateQueries(); onClose() } })
  function field(name: string, label: string, inputType = 'text', options?: { value: string; label: string }[]) {
    return <label className="field" key={name}><span>{label}</span>{options ? <select aria-label={label} aria-invalid={!!errors[name]} {...register(name)}>{options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
      : <input aria-label={label} aria-invalid={!!errors[name]} type={inputType} step={inputType === 'number' ? '0.01' : undefined} {...register(name, { valueAsNumber: inputType === 'number' })} />}
      {errors[name] && <small className="field-error">{String(errors[name]?.message)}</small>}</label>
  }
  const transaction = kind === 'transactions' || kind === 'recurring'
  return <Modal title={`${existing ? 'Edit' : 'New'} ${titles[kind]}`} onClose={onClose}>
    <form className="entry-form" onSubmit={handleSubmit(values => mutation.mutate(values))} noValidate>
      {(transaction || kind === 'categories') && <fieldset className="segmented"><legend className="sr-only">Transaction type</legend>{['Expense', 'Income'].map(value => <label className={type === value ? 'selected' : ''} key={value}><input type="radio" value={value} {...register('type')} onChange={() => { setType(value); setValue('type', value); if (transaction) setValue('categoryId', '') }} />{value}</label>)}</fieldset>}
      {transaction && <>{field('description', 'Description')}{field('amount', `Amount (${user?.currency})`, 'number')}
        <div className="form-grid">{field('accountId', 'Account', 'text', [{ value: '', label: 'Choose account' }, ...accounts.map(account => ({ value: account.id, label: account.name }))])}
          {field('categoryId', 'Category', 'text', [{ value: '', label: 'Choose category' }, ...categories.filter(category => category.type === type).map(category => ({ value: category.id, label: category.name }))])}</div>
        {kind === 'transactions' ? field('transactionDate', 'Date', 'date') : <><div className="form-grid">{field('nextOccurrence', 'Next occurrence', 'date')}{field('frequency', 'Frequency', 'text', ['Daily', 'Weekly', 'Monthly', 'Yearly'].map(value => ({ value, label: value })))}</div><label className="check"><input type="checkbox" {...register('isActive')} />Active</label></>}
      </>}
      {kind === 'accounts' && <>{field('name', 'Account name')}{field('type', 'Account type', 'text', ['Checking', 'Savings', 'Cash', 'Credit'].map(value => ({ value, label: value })))}{field('openingBalance', `Opening balance (${user?.currency})`, 'number')}<input type="hidden" {...register('currency')} /></>}
      {kind === 'categories' && <>{field('name', 'Category name')}{field('color', 'Color', 'color')}</>}
      {kind === 'budgets' && <>{field('categoryId', 'Category', 'text', [{ value: '', label: 'Choose category' }, ...categories.filter(category => category.type === 'Expense').map(category => ({ value: category.id, label: category.name }))])}<div className="form-grid">{field('month', 'Month', 'month')}{field('limit', `Monthly limit (${user?.currency})`, 'number')}</div></>}
      {mutation.error && <ErrorMessage message={mutation.error.message} />}
      <div className="form-actions"><Button onClick={onClose}>Cancel</Button><Button type="submit" appearance="primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save changes'}</Button></div>
    </form>
  </Modal>
}