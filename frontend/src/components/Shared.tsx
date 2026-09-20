import { Button, Tooltip, Spinner } from '@fluentui/react-components'
import { useEffect, useId, useRef } from 'react'
import { DismissRegular, ArrowDownloadRegular } from '@fluentui/react-icons'
import type { ReactNode, ReactElement } from 'react'
import { format, parseISO } from 'date-fns'

export const today = () => format(new Date(), 'yyyy-MM-dd')
export const currentMonth = () => format(new Date(), 'yyyy-MM')
export const money = (value: number, currency = 'USD') => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
export const dateLabel = (value: string) => format(parseISO(value), 'MMM d, yyyy')
export const monthLabel = (value: string) => format(parseISO(`${value.slice(0, 7)}-01`), 'MMMM yyyy')

export function IconButton({ label, icon, onClick, disabled }: { label: string; icon: ReactElement; onClick: () => void; disabled?: boolean }) {
  return <Tooltip content={label} relationship="label"><Button aria-label={label} icon={icon} onClick={onClick} disabled={disabled} appearance="subtle" /></Tooltip>
}
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="modal-heading"><h2 id={titleId}>{title}</h2><IconButton label="Close dialog" icon={<DismissRegular />} onClick={onClose} /></div>
    {children}
  </dialog>
}
export function Confirm({ title, onConfirm, onClose, pending, error }: { title: string; onConfirm: () => void; onClose: () => void; pending: boolean; error?: string }) {
  return <Modal title={title} onClose={onClose}><p className="muted">This action cannot be undone.</p>{error && <ErrorMessage message={error} />}<div className="form-actions">
    <Button onClick={onClose}>Cancel</Button><Button appearance="primary" disabled={pending} onClick={onConfirm}>{pending ? 'Deleting...' : 'Delete'}</Button>
  </div></Modal>
}
export function ErrorMessage({ message }: { message: string }) { return <div role="alert" className="error">{message}</div> }
export function Loading() { return <div className="loading"><Spinner size="small" label="Loading your workspace" /></div> }
export function Empty({ title, action }: { title: string; action?: ReactNode }) { return <div className="empty"><span className="empty-mark">0</span><h3>{title}</h3>{action}</div> }
export function DownloadSample() { return <Button as="a" href="/sample-transactions.csv" download icon={<ArrowDownloadRegular />}>Sample CSV</Button> }