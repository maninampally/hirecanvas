import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const DEFAULT_CAP = 100

export async function GET() {
  const rawCap = Number(process.env.BETA_USER_CAP || DEFAULT_CAP)
  const cap = Number.isFinite(rawCap) && rawCap > 0 ? Math.floor(rawCap) : DEFAULT_CAP

  try {
    const supabase = createServiceClient()
    const { count, error } = await supabase
      .from('app_users')
      .select('id', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json(
        { allowed: false, cap, count: null, error: 'cap_check_failed' },
        { status: 500 }
      )
    }

    const safeCount = count ?? 0
    return NextResponse.json({ allowed: safeCount < cap, cap, count: safeCount })
  } catch {
    return NextResponse.json(
      { allowed: false, cap, count: null, error: 'cap_check_failed' },
      { status: 500 }
    )
  }
}
