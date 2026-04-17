import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check database connection
    const { error: dbError } = await supabase
      .from('app_users')
      .select('count')
      .limit(1)
      .single()

    if (dbError && dbError.code !== 'PGRST116') {
      throw new Error('Database connection failed')
    }

    return Response.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          app: 'running',
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return Response.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
