import React from 'react'

type Tier = 'free' | 'pro' | 'elite' | 'admin'

const tierRank: Record<Tier, number> = {
  free: 0,
  pro: 1,
  elite: 2,
  admin: 3,
}

function hasRequiredTier(currentTier: Tier | undefined, allowed: Tier[]) {
  if (!currentTier) return false
  const currentRank = tierRank[currentTier]
  return allowed.some((tier) => currentRank >= tierRank[tier])
}

type TierGateProps = {
  currentTier?: Tier
  allowedTiers: Tier[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function TierGate({ currentTier, allowedTiers, children, fallback = null }: TierGateProps) {
  return hasRequiredTier(currentTier, allowedTiers) ? <>{children}</> : <>{fallback}</>
}
