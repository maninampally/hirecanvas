type LogLevel = 'info' | 'warn' | 'error'

type LogMeta = Record<string, unknown>

function toErrorShape(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unknown error',
  }
}

function write(level: LogLevel, event: string, meta?: LogMeta) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(meta || {}),
  }

  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.log(line)
}

export function logInfo(event: string, meta?: LogMeta) {
  write('info', event, meta)
}

export function logWarn(event: string, meta?: LogMeta) {
  write('warn', event, meta)
}

export function logError(event: string, error?: unknown, meta?: LogMeta) {
  write('error', event, {
    ...(meta || {}),
    ...(typeof error === 'undefined' ? {} : { error: toErrorShape(error) }),
  })
}
