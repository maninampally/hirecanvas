'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getReviewQueueItems, dismissReviewItem, acceptReviewItem } from '@/actions/jobs'
import { MdCheck, MdClose, MdRefresh, MdOutlineSelectAll, MdCheckBoxOutlineBlank, MdCheckBox } from 'react-icons/md'

type BorderlineExtraction = {
  stage2?: { company?: string; role?: string; status?: string }
  stage3?: { corrected_company?: string; corrected_role?: string; corrected_status?: string }
}

type ReviewItem = {
  id: string
  gmail_message_id: string
  subject: string
  candidate_reason: string
  borderline_extraction: BorderlineExtraction
  processed_at: string
  received_at?: string
}

export function ReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const data = await getReviewQueueItems()
      setItems(data as ReviewItem[])
    } catch (error) {
      toast.error('Failed to load review queue: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems()
  }, [])

  const handleDismiss = async (id: string) => {
    try {
      await dismissReviewItem(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success('Item rejected')
    } catch (error) {
      toast.error('Failed to reject: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const handleAccept = async (item: ReviewItem) => {
    try {
      const stage2 = item.borderline_extraction?.stage2
      const stage3 = item.borderline_extraction?.stage3

      const company = stage3?.corrected_company || stage2?.company || 'Unknown Company'
      const title = stage3?.corrected_role || stage2?.role || 'Unknown Role'
      const statusRaw = stage3?.corrected_status || stage2?.status || 'Applied'
      
      let status: 'Wishlist' | 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected' = 'Applied'
      if (['wishlist'].includes(statusRaw.toLowerCase())) status = 'Wishlist'
      if (['applied'].includes(statusRaw.toLowerCase())) status = 'Applied'
      if (['screening', 'screen'].includes(statusRaw.toLowerCase())) status = 'Screening'
      if (['interview', 'interviews'].includes(statusRaw.toLowerCase())) status = 'Interview'
      if (['offer', 'offered'].includes(statusRaw.toLowerCase())) status = 'Offer'
      if (['rejected', 'reject'].includes(statusRaw.toLowerCase())) status = 'Rejected'

      await acceptReviewItem(item.id, {
        title,
        company,
        status,
        url: '',
        notes: `Auto-accepted from review queue.\nReason flagged: ${item.candidate_reason}`,
        applied_date: item.received_at ? item.received_at.slice(0, 10) : undefined,
      })
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setSelectedIds((prev) => prev.filter((id) => id !== item.id))
      toast.success('Job created from email')
    } catch (error) {
      toast.error('Failed to accept: ' + (error instanceof Error ? error.message : String(error)))
      throw error // Re-throw to be caught by bulk handlers if needed
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((i) => i.id))
    }
  }

  const handleBulkAccept = async (idsToAccept: string[]) => {
    setIsProcessing(true)
    const itemsToProcess = items.filter((i) => idsToAccept.includes(i.id))
    let successCount = 0
    let failCount = 0

    for (const item of itemsToProcess) {
      try {
        await handleAccept(item)
        successCount++
      } catch {
        failCount++
      }
    }

    if (successCount > 0) toast.success(`Accepted ${successCount} jobs`)
    if (failCount > 0) toast.error(`Failed to accept ${failCount} jobs`)
    setIsProcessing(false)
  }

  const handleBulkDismiss = async (idsToDismiss: string[]) => {
    setIsProcessing(true)
    let successCount = 0
    let failCount = 0

    for (const id of idsToDismiss) {
      try {
        await dismissReviewItem(id)
        setItems((prev) => prev.filter((item) => item.id !== id))
        setSelectedIds((prev) => prev.filter((i) => i !== id))
        successCount++
      } catch {
        failCount++
      }
    }

    if (successCount > 0) toast.success(`Dismissed ${successCount} jobs`)
    if (failCount > 0) toast.error(`Failed to dismiss ${failCount} jobs`)
    setIsProcessing(false)
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Loading review queue...</div>
  }

  if (items.length === 0) {
    return null
  }

  return (
    <Card className="mb-8 border-amber-200 shadow-md shadow-amber-500/5">
      <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg text-amber-900 flex items-center gap-2">
              <Badge variant="amber" className="px-2 py-0.5">{items.length}</Badge> Needs Review
            </CardTitle>
            <p className="text-sm text-amber-700 mt-1">
              AI found jobs but confidence was low or data was missing. Review them manually.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.length > 0 ? (
              <>
                <span className="text-sm font-medium text-amber-800 mr-2">{selectedIds.length} selected</span>
                <Button variant="outline" size="sm" onClick={() => handleBulkDismiss(selectedIds)} disabled={isProcessing} className="text-rose-600 border-rose-200 hover:bg-rose-50">
                  Delete Selected
                </Button>
                <Button size="sm" onClick={() => handleBulkAccept(selectedIds)} disabled={isProcessing} className="bg-teal-600 hover:bg-teal-700 text-white">
                  Accept Selected
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => handleBulkAccept(items.map(i => i.id))} disabled={isProcessing} className="bg-teal-600 hover:bg-teal-700 text-white">
                <MdOutlineSelectAll className="mr-1" /> Accept All
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={fetchItems} disabled={isProcessing} className="text-amber-700">
              <MdRefresh className="mr-1" /> Refresh
            </Button>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-amber-100 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleSelectAll} className="h-6 px-2 text-amber-800 hover:bg-amber-100/50">
            {selectedIds.length === items.length ? (
              <><MdCheckBox className="mr-2 text-lg" /> Deselect All</>
            ) : (
              <><MdCheckBoxOutlineBlank className="mr-2 text-lg" /> Select All</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-amber-100">
        {items.map((item) => {
          const stage2 = item.borderline_extraction?.stage2 || {}
          const stage3 = item.borderline_extraction?.stage3 || {}
          const company = stage3.corrected_company || stage2.company || 'Unknown'
          const role = stage3.corrected_role || stage2.role || 'Unknown Role'
          const status = stage3.corrected_status || stage2.status || 'Applied'
          const date = new Date(item.processed_at).toLocaleDateString()

          return (
            <div key={item.id} className="p-4 hover:bg-amber-50/30 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="pt-1">
                  <button type="button" onClick={() => toggleSelect(item.id)} className="text-amber-600 hover:text-amber-800 focus:outline-none">
                    {selectedIds.includes(item.id) ? (
                      <MdCheckBox className="text-xl" />
                    ) : (
                      <MdCheckBoxOutlineBlank className="text-xl text-slate-300" />
                    )}
                  </button>
                </div>
                <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-slate-900">{company}</h4>
                  <span className="text-slate-400 text-sm">—</span>
                  <span className="font-medium text-slate-700">{role}</span>
                  <Badge variant="slate" className="text-xs ml-2">{status}</Badge>
                  <span className="text-xs text-slate-400 ml-auto">{date}</span>
                </div>
                <p className="text-sm text-slate-600 truncate">
                  <span className="font-medium text-slate-500">Subject:</span> {item.subject}
                </p>
                <div className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded inline-block mt-1">
                  <span className="font-semibold">Flagged:</span> {item.candidate_reason}
                </div>
              </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full pl-8 md:pl-0 md:w-auto">
                <Button variant="outline" size="sm" className="flex-1 md:flex-none text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleDismiss(item.id)} disabled={isProcessing}>
                  <MdClose className="mr-1" /> Dismiss
                </Button>
                <Button size="sm" className="flex-1 md:flex-none bg-teal-600 hover:bg-teal-700 text-white" onClick={() => handleAccept(item)} disabled={isProcessing}>
                  <MdCheck className="mr-1" /> Accept as Job
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
