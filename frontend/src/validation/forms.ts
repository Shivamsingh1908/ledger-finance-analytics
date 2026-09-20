import { z } from 'zod'

const money = z.number().min(0.01, 'Enter an amount above zero').max(999999999).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Use at most two decimal places')
const date = z.string().regex(/^20\d{2}-\d{2}-\d{2}$|^2100-\d{2}-\d{2}$/, 'Enter a date between 2000 and 2100')
export const transactionSchema = z.object({
  accountId: z.string().min(1, 'Choose an account'), categoryId: z.string().min(1, 'Choose a category'),
  type: z.enum(['Expense', 'Income']), amount: money,
  description: z.string().trim().min(1, 'Enter a description').max(300), transactionDate: date,
})
export const recurringSchema = transactionSchema.omit({ transactionDate: true }).extend({ frequency: z.enum(['Daily', 'Weekly', 'Monthly', 'Yearly']), nextOccurrence: date, isActive: z.boolean() })
export const budgetSchema = z.object({ categoryId: z.string().min(1, 'Choose a category'), month: z.string().regex(/^\d{4}-\d{2}$/), limit: money })
export const accountSchema = z.object({ name: z.string().trim().min(1, 'Enter an account name').max(80), type: z.enum(['Checking', 'Savings', 'Cash', 'Credit']), openingBalance: z.number().min(-999999999).max(999999999).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, 'Use at most two decimal places'), currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']) })
export const categorySchema = z.object({ name: z.string().trim().min(1, 'Enter a category name').max(60), type: z.enum(['Expense', 'Income']), color: z.string().regex(/^#[a-fA-F0-9]{6}$/) })
export const registerSchema = z.object({ email: z.email(), password: z.string().min(12, 'Use at least 12 characters').max(128), currency: z.enum(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD']) })
export const loginSchema = registerSchema.omit({ currency: true }).extend({ password: z.string().min(1, 'Enter your password').max(128) })