import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const ICON_SRC = '/icon-512.png'
const WORDMARK_SRC = '/logo-wordmark.png'
const WORDMARK_ASPECT = 1024 / 572

type LogoIconProps = {
  size?: number
  className?: string
  priority?: boolean
}

export function LogoIcon({ size = 36, className, priority }: LogoIconProps) {
  return (
    <Image
      src={ICON_SRC}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      priority={priority}
      aria-hidden
    />
  )
}

type LogoWordmarkProps = {
  height?: number
  className?: string
  priority?: boolean
}

export function LogoWordmark({ height = 40, className, priority }: LogoWordmarkProps) {
  const width = Math.round(height * WORDMARK_ASPECT)
  return (
    <Image
      src={WORDMARK_SRC}
      alt="HireCanvas"
      width={width}
      height={height}
      className={cn('h-auto w-auto shrink-0', className)}
      style={{ height, width: 'auto', maxWidth: width }}
      priority={priority}
    />
  )
}

type LogoMarkProps = {
  iconSize?: number
  showText?: boolean
  textClassName?: string
  className?: string
  priority?: boolean
}

export function LogoMark({
  iconSize = 36,
  showText = true,
  textClassName,
  className,
  priority,
}: LogoMarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5 min-w-0', className)}>
      <LogoIcon size={iconSize} priority={priority} />
      {showText && (
        <span
          className={cn(
            'truncate text-base font-bold tracking-tight text-slate-800',
            textClassName,
          )}
        >
          HireCanvas
        </span>
      )}
    </div>
  )
}

type LogoLinkProps = {
  href?: string
  className?: string
  children: React.ReactNode
}

function LogoLink({ href = '/', className, children }: LogoLinkProps) {
  if (!href) {
    return <div className={cn('inline-flex items-center', className)}>{children}</div>
  }
  return (
    <Link href={href} className={cn('inline-flex items-center', className)}>
      {children}
    </Link>
  )
}

type SidebarLogoProps = {
  collapsed?: boolean
  href?: string
  className?: string
}

export function SidebarLogo({ collapsed = false, href = '/dashboard', className }: SidebarLogoProps) {
  return (
    <LogoLink href={href} className={className}>
      <LogoMark iconSize={36} showText={!collapsed} />
    </LogoLink>
  )
}
