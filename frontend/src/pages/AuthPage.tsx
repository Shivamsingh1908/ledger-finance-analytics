import { useState } from 'react'
import { useForm, type FieldValues, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@fluentui/react-components'
import { LeafTwoRegular, ArrowRightRegular, ChartMultipleRegular, DocumentArrowUpRegular, ArrowRepeatAllRegular, LockClosedRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { useMutation } from '@tanstack/react-query'
import { save } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { loginSchema, registerSchema } from '../validation/forms'
import type { Session } from '../types'
import { ErrorMessage } from '../components/Shared'

const features = [
  { icon: <ChartMultipleRegular />, title: 'Insightful dashboards', text: 'Live charts for income, expenses, savings rate and six-month trends.' },
  { icon: <DocumentArrowUpRegular />, title: 'Effortless CSV import', text: 'Preview statements with row validation and automatic duplicate detection.' },
  { icon: <ArrowRepeatAllRegular />, title: 'Budgets & recurring', text: 'Set monthly limits and automate the bills that repeat on schedule.' },
  { icon: <LockClosedRegular />, title: 'Private by design', text: 'Hashed passwords, and every record scoped to your account alone.' },
]
const highlights = ['Track unlimited transactions', 'Multi-account & category tagging', 'Works on mobile and desktop']

export function AuthPage() {
  const [registering, setRegistering] = useState(false)
  const { login } = useAuth()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FieldValues>({ resolver: zodResolver(registering ? registerSchema : loginSchema) as unknown as Resolver<FieldValues>, defaultValues: { currency: 'USD' } })
  const mutation = useMutation({ mutationFn: (values: FieldValues) => save<Session>(`/auth/${registering ? 'register' : 'login'}`, values), onSuccess: login })
  return <main className="auth-page">
    <aside className="auth-panel">
      <div className="auth-brand brand"><span className="brand-symbol"><LeafTwoRegular /></span>ledger<span className="brand-dot">.</span></div>
      <div className="auth-pitch">
        <p className="eyebrow">PERSONAL FINANCE, BEAUTIFULLY SIMPLE</p>
        <h2 className="auth-pitch-title">Every dollar, in focus.</h2>
        <p className="auth-pitch-sub">Track spending, plan budgets and understand exactly where your money goes — all in one calm, private workspace.</p>
        <div className="auth-preview" aria-hidden="true">
          <div className="auth-preview-top"><div><span className="auth-preview-label">Total balance · September</span><strong>$12,480</strong></div><span className="auth-preview-badge">▲ 8.2%</span></div>
          <div className="auth-preview-bars">{[46, 64, 40, 72, 52, 84].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div>
        </div>
        <ul className="auth-features">{features.slice(0, 3).map(feature => <li key={feature.title}><span className="auth-feature-icon">{feature.icon}</span><span className="auth-feature-text"><strong>{feature.title}</strong><span>{feature.text}</span></span></li>)}</ul>
      </div>
      <span className="auth-foot">A clearer picture. One day at a time.</span>
    </aside>
    <section className="auth-surface"><div className="auth-card">
      <div className="auth-mobile-brand brand"><span className="brand-symbol"><LeafTwoRegular /></span>ledger<span className="brand-dot">.</span></div>
      <div className="auth-heading"><p className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</p><h1>{registering ? 'Your next chapter starts here.' : 'Welcome back.'}</h1><p className="muted">{registering ? 'Create your personal finance account in under a minute.' : 'Sign in to your financial workspace.'}</p></div>
      <form className="entry-form" onSubmit={handleSubmit(values => mutation.mutate(values))} noValidate>
        <label className="field"><span>Email address</span><input type="email" autoComplete="email" {...register('email')} />{errors.email && <small className="field-error">{String(errors.email.message)}</small>}</label>
        <label className="field"><span>Password</span><input type="password" autoComplete={registering ? 'new-password' : 'current-password'} {...register('password')} />{errors.password && <small className="field-error">{String(errors.password.message)}</small>}</label>
        {registering && <label className="field"><span>Reporting currency</span><select {...register('currency')}>{['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'].map(currency => <option key={currency}>{currency}</option>)}</select></label>}
        {mutation.error && <ErrorMessage message={mutation.error.message} />}
        <Button type="submit" appearance="primary" icon={<ArrowRightRegular />} iconPosition="after" disabled={mutation.isPending}>{mutation.isPending ? 'Please wait...' : registering ? 'Create account' : 'Sign in'}</Button>
      </form>
      {registering && <ul className="auth-highlights">{highlights.map(item => <li key={item}><CheckmarkCircleRegular />{item}</li>)}</ul>}
      <div className="auth-switch">{registering ? 'Already have an account?' : 'New to Ledger?'}<Button appearance="transparent" onClick={() => { setRegistering(!registering); mutation.reset(); reset({ currency: 'USD' }) }}>{registering ? 'Sign in' : 'Create an account'}</Button></div>
      <div className="auth-trust"><span><LockClosedRegular />Bank-grade security</span><span><CheckmarkCircleRegular />Free to use</span><span><LeafTwoRegular />Private by design</span></div>
    </div></section>
  </main>
}