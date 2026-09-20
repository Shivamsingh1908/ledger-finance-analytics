import { describe, expect, it } from 'vitest'
import { accountSchema, budgetSchema, registerSchema, transactionSchema } from './forms'

const valid = { accountId: 'account', categoryId: 'category', type: 'Expense', amount: 12.34, description: 'Coffee', transactionDate: '2026-09-18' }
describe('Finance form validation', () => {
  it('accepts valid transactions and trims descriptions', () => {
    expect(transactionSchema.parse({ ...valid, description: ' Coffee ' }).description).toBe('Coffee')
  })
  it.each([0, -1, 0.001, 12.345, 1000000000])('rejects invalid amount %s', amount => {
    expect(transactionSchema.safeParse({ ...valid, amount }).success).toBe(false)
  })
  it('rejects missing ownership references and blank descriptions', () => {
    expect(transactionSchema.safeParse({ ...valid, accountId: '', categoryId: '', description: ' ' }).success).toBe(false)
  })
  it('requires a long registration password', () => {
    expect(registerSchema.safeParse({ email: 'person@example.com', password: 'short', currency: 'USD' }).success).toBe(false)
  })
  it('allows a negative opening balance for credit accounts', () => {
    expect(accountSchema.safeParse({ name: 'Credit', type: 'Credit', openingBalance: -250, currency: 'USD' }).success).toBe(true)
  })
  it('validates budgets', () => {
    expect(budgetSchema.safeParse({ categoryId: 'food', month: '2026-09', limit: 500 }).success).toBe(true)
    expect(budgetSchema.safeParse({ categoryId: 'food', month: 'September', limit: -2 }).success).toBe(false)
  })
})