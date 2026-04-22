'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MdNotifications } from 'react-icons/md'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/actions/notifications'

export function NotificationCenter() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notification-center', 15],
    queryFn: () => getNotifications(15),
  })

  const items = data?.items || ([] as NotificationItem[])
  const unreadCount = data?.unreadCount || 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)
          void refetch()
        }}
        className="relative h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <MdNotifications className="text-xl" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button
              type="button"
              className="text-xs text-indigo-600 hover:text-indigo-700"
              onClick={async () => {
                await markAllNotificationsRead()
                queryClient.setQueryData<{ items: NotificationItem[]; unreadCount: number }>(
                  ['notification-center', 15],
                  (prev) => {
                    if (!prev) return { items: [], unreadCount: 0 }
                    return {
                      unreadCount: 0,
                      items: prev.items.map((item) => ({ ...item, is_read: true })),
                    }
                  }
                )
              }}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {isLoading && <p className="px-3 py-3 text-sm text-slate-500">Loading...</p>}
            {!isLoading && items.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-500">No notifications yet.</p>
            )}
            {!isLoading &&
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={async () => {
                    if (!item.is_read) {
                      await markNotificationRead(item.id)
                      queryClient.setQueryData<{ items: NotificationItem[]; unreadCount: number }>(
                        ['notification-center', 15],
                        (prev) => {
                          if (!prev) return { items: [], unreadCount: 0 }
                          return {
                            unreadCount: Math.max(0, prev.unreadCount - 1),
                            items: prev.items.map((row) =>
                              row.id === item.id ? { ...row, is_read: true } : row
                            ),
                          }
                        }
                      )
                    }
                    setOpen(false)
                    if (item.action_url) router.push(item.action_url)
                  }}
                  className={`w-full border-b border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50 ${item.is_read ? '' : 'bg-indigo-50/40'}`}
                >
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  {item.message && <p className="mt-0.5 text-xs text-slate-600">{item.message}</p>}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

