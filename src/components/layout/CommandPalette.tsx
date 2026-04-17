'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const commandItems = [
  { label: 'Overview', href: '/' },
  { label: 'Applications', href: '/jobs' },
  { label: 'Contacts', href: '/contacts' },
  { label: 'Outreach', href: '/outreach' },
  { label: 'Reminders', href: '/reminders' },
  { label: 'Resumes', href: '/resumes' },
  { label: 'Interview Prep', href: '/interview-prep' },
  { label: 'Templates', href: '/templates' },
  { label: 'Settings', href: '/settings' },
  { label: 'Admin', href: '/admin' },
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
    <div className="fixed inset-0 z-50 bg-black/30 p-4" onClick={() => onOpenChange(false)}>
      <div className="mx-auto mt-20 w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <Command className="w-full">
          <Command.Input
            placeholder="Search pages..."
            className="w-full border-b border-slate-200 px-4 py-3 text-sm outline-none"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-2 text-sm text-slate-500">No results found.</Command.Empty>
            <Command.Group heading="Navigation">
              {commandItems.map((item) => (
                <Command.Item
                  key={item.href}
                  value={item.label}
                  className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-700 data-[selected=true]:bg-teal-50 data-[selected=true]:text-teal-700"
                  onSelect={() => {
                    onOpenChange(false)
                    router.push(item.href)
                  }}
                >
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
