'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import type { IconType } from 'react-icons'
import {
  MdAdminPanelSettings,
  MdArticle,
  MdDashboard,
  MdDescription,
  MdBalance,
  MdNotifications,
  MdOutlineEmail,
  MdPeople,
  MdQuiz,
  MdSearch,
  MdSettings,
  MdWork,
} from 'react-icons/md'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const commandItems: { label: string; href: string; Icon: IconType }[] = [
  { label: 'Overview', href: '/dashboard', Icon: MdDashboard },
  { label: 'Applications', href: '/jobs', Icon: MdWork },
  { label: 'Contacts', href: '/contacts', Icon: MdPeople },
  { label: 'Outreach', href: '/outreach', Icon: MdOutlineEmail },
  { label: 'Reminders', href: '/reminders', Icon: MdNotifications },
  { label: 'Resumes', href: '/resumes', Icon: MdDescription },
  { label: 'Interview Prep', href: '/interview-prep', Icon: MdQuiz },
  { label: 'Templates', href: '/templates', Icon: MdArticle },
  { label: 'Billing', href: '/billing', Icon: MdBalance },
  { label: 'Settings', href: '/settings', Icon: MdSettings },
  { label: 'Admin', href: '/admin', Icon: MdAdminPanelSettings },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(!open)
      }
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/35 p-4 pt-24"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="h-fit w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_48px_rgba(0,0,0,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <Command className="w-full">
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5">
            <MdSearch className="text-lg text-slate-400" />
            <Command.Input
              placeholder="Search pages, actions..."
              className="flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-400">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto px-1.5 py-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-slate-400">No results found</Command.Empty>
            <Command.Group
              heading="Navigation"
              className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            >
              {commandItems.map((item) => {
                const Icon = item.Icon
                return (
                  <Command.Item
                    key={item.href}
                    value={item.label}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 data-[selected=true]:bg-teal-50 data-[selected=true]:text-teal-800"
                    onSelect={() => {
                      onOpenChange(false)
                      router.push(item.href)
                    }}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                      <Icon className="text-base" />
                    </span>
                    {item.label}
                  </Command.Item>
                )
              })}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
