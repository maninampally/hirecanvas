import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getValidGmailAccessToken } from '@/lib/gmail/token'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { to?: string; subject?: string; body?: string }
    const { to, subject, body: emailBody } = body

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields: to, subject' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data: rows } = await serviceClient
      .from('oauth_tokens')
      .select('id,provider_email')
      .eq('user_id', user.id)
      .eq('provider', 'google_gmail')
      .eq('is_revoked', false)
      .order('updated_at', { ascending: false })
      .limit(1)

    const tokenRow = rows?.[0]
    if (!tokenRow?.id || !tokenRow.provider_email) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Gmail in Settings.' },
        { status: 400 }
      )
    }

    const { accessToken } = await getValidGmailAccessToken(user.id, tokenRow.id)

    const messageParts = [
      `From: ${tokenRow.provider_email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      emailBody || '',
    ]
    const rawMessage = Buffer.from(messageParts.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    })

    if (!gmailRes.ok) {
      const errData = await gmailRes.json().catch(() => ({})) as { error?: { message?: string } }
      return NextResponse.json(
        { error: errData?.error?.message || 'Failed to send email via Gmail' },
        { status: gmailRes.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
