import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

type Params = {
  code: string
}

export default async function ReferralLandingPage({ params }: { params: Promise<Params> }) {
  const { code } = await params
  const cookieStore = await cookies()
  cookieStore.set('hc_ref', code, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  redirect('/register')
}
