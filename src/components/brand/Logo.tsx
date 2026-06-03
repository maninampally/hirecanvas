import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Browser tab, PWA, and collapsed sidebar */
const ICON_SRC = '/icon.png'
/** Primary branding in header, sidebar, auth, landing */
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
  /** When true, shows logo-wordmark.png; when false, icon only */
  showText?: boolean
  wordmarkHeight?: number
  textClassName?: string
  className?: string
  priority?: boolean
}

/** Primary logo: wordmark when expanded, icon-only when collapsed */
export function LogoMark({
  iconSize = 36,
  showText = true,
  wordmarkHeight = 40,
  textClassName,
  className,
  priority,
}: LogoMarkProps) {
  if (showText) {
    return (
      <div className={cn('flex items-center min-w-0', className)}>
        <LogoWordmark height={wordmarkHeight} className={textClassName} priority={priority} />
      </div>
    )
  }
  return (
    <div className={cn('flex items-center min-w-0', className)}>
      <LogoIcon size={iconSize} priority={priority} />
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
      {collapsed ? (
        <LogoIcon size={40} priority />
      ) : (
        <LogoWordmark height={48} priority />
      )}
    </LogoLink>
  )
}
