import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@fluentui/react-components'
import { DocumentArrowUpRegular, CheckmarkCircleRegular } from '@fluentui/react-icons'
import { api, save } from '../../api/client'
import type { Account, Preview, ImportBatch } from '../../types'
import { dateLabel, DownloadSample, ErrorMessage } from '../../components/Shared'

export function Imports({ accounts }: { accounts: Account[] }) {
  const [accountId, setAccountId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<ImportBatch | null>(null)
  const queryClient = useQueryClient()
  const history = useQuery({ queryKey: ['imports'], queryFn: () => api<ImportBatch[]>('/imports') })
  const upload = useMutation({ mutationFn: async () => {
    if (!file || !file.name.toLowerCase().endsWith('.csv') || file.size > 2000000 || file.size === 0) throw new Error('Choose a non-empty CSV file under 2 MB.')
    const body = new FormData(); body.append('file', file); body.append('accountId', accountId || accounts[0]?.id || '')
    return api<Preview>('/imports/preview', { method: 'POST', body })
  }, onSuccess: value => { setPreview(value); setResult(null); confirm.reset() } })
  const confirm = useMutation({ mutationFn: () => save<ImportBatch>('/imports/confirm', { previewId: preview!.previewId }), onSuccess: async value => { setResult(value); setPreview(null); await queryClient.invalidateQueries() } })
  const busy = upload.isPending || confirm.isPending
  function clearPreview() {
    setPreview(null)
    setResult(null)
    upload.reset()
    confirm.reset()
  }
  return <section><div className="section-heading"><div><h2>Bring your transactions together</h2><p>CSV import</p></div><DownloadSample /></div>
    <form className="import-upload" onSubmit={event => { event.preventDefault(); if (!busy) { clearPreview(); upload.mutate() } }}><DocumentArrowUpRegular className="upload-icon" /><label className="field"><span>Destination account</span><select aria-label="Destination account" disabled={busy} value={accountId || accounts[0]?.id || ''} onChange={event => { setAccountId(event.target.value); clearPreview() }}>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="field file-field"><span>CSV file</span><input type="file" accept=".csv,text/csv" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); clearPreview() }} /></label><Button appearance="primary" type="submit" disabled={busy || !file || !accounts.length}>{upload.isPending ? 'Validating...' : 'Preview import'}</Button></form>
    {upload.error && <ErrorMessage message={upload.error.message} />}{confirm.error && <ErrorMessage message={confirm.error.message} />}
    {result && <div role="status" className="success"><CheckmarkCircleRegular /><div><strong>Import complete</strong><p>{result.importedCount} imported, {result.duplicateCount} duplicates skipped, {result.failedCount} invalid rows skipped.</p></div></div>}
    {preview && <section className="import-preview"><div className="section-heading"><div><h2>{preview.fileName}</h2><p><span className="positive">{preview.validCount} valid</span> / {preview.duplicateCount} duplicates / <span className="negative">{preview.failedCount} invalid</span></p></div><Button appearance="primary" onClick={() => confirm.mutate()} disabled={busy || preview.validCount === 0}>{confirm.isPending ? 'Importing...' : `Import ${preview.validCount} transactions`}</Button></div><div className="table-scroll preview-scroll"><table><thead><tr><th>Row</th><th>Description</th><th>Date</th><th>Amount</th><th>Category</th><th>Status</th><th>Validation</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.row}><td>{row.row}</td><td>{row.description}</td><td className="nowrap">{row.date}</td><td>{row.amount}</td><td>{row.category}</td><td><span className={`tag ${row.status.toLowerCase()}`}>{row.status}</span></td><td>{row.error}</td></tr>)}</tbody></table></div></section>}
    <section className="import-history"><div className="section-heading"><h2>Import history</h2></div>{history.error && <ErrorMessage message={history.error.message} />}{history.data?.length ? <div className="table-scroll"><table><thead><tr><th>File</th><th>Date</th><th>Imported</th><th>Duplicates</th><th>Invalid</th></tr></thead><tbody>{history.data.map(batch => <tr key={batch.id}><td>{batch.fileName}</td><td>{dateLabel(batch.createdAt)}</td><td>{batch.importedCount}</td><td>{batch.duplicateCount}</td><td>{batch.failedCount}</td></tr>)}</tbody></table></div> : <p className="muted">No imports yet.</p>}</section>
  </section>
}