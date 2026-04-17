import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('TOKEN_ENCRYPTION_KEY is required')
  }

  // Accept either raw secrets or base64-encoded keys and normalize to 32 bytes.
  if (raw.length === 44 && raw.endsWith('=')) {
    const decoded = Buffer.from(raw, 'base64')
    if (decoded.length === 32) return decoded
  }

  return createHash('sha256').update(raw).digest()
}

export function encryptSecret(plainText: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.')
}

export function decryptSecret(cipherText: string) {
  const [ivRaw, authTagRaw, payloadRaw] = cipherText.split('.')
  if (!ivRaw || !authTagRaw || !payloadRaw) {
    throw new Error('Invalid encrypted token format')
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivRaw, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payloadRaw, 'base64')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
