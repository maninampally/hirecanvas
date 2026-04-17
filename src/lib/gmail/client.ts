type GmailListResponse = {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
}

type GmailMessageResponse = {
  id: string
  threadId: string
  snippet?: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
  }
  internalDate?: string
}

function getAuthHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

export async function listGmailMessages(accessToken: string, query = 'subject:(job OR interview OR application)', maxResults = 20) {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(maxResults))

  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(accessToken),
  })

  if (!response.ok) {
    throw new Error('Failed to list Gmail messages')
  }

  return (await response.json()) as GmailListResponse
}

export async function getGmailMessage(accessToken: string, messageId: string) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`
  const response = await fetch(url, {
    headers: getAuthHeaders(accessToken),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch Gmail message')
  }

  return (await response.json()) as GmailMessageResponse
}
