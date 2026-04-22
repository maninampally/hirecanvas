import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-sesv2'

export type EmailPayload = {
  to: string
  subject: string
  html: string
  text?: string
}

export type EmailSendResult = {
  delivered: boolean
  dryRun: boolean
  messageId?: string
}

let sesClientSingleton: SESv2Client | null = null

function getSesClient() {
  if (!sesClientSingleton) {
    sesClientSingleton = new SESv2Client({
      region: process.env.AWS_SES_REGION || 'us-east-1',
      credentials:
        process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
            }
          : undefined,
    })
  }

  return sesClientSingleton
}

function shouldDryRun() {
  if (process.env.SES_DRY_RUN === 'true') return true

  return !(
    process.env.AWS_SES_ACCESS_KEY_ID &&
    process.env.AWS_SES_SECRET_ACCESS_KEY &&
    process.env.SES_FROM_EMAIL
  )
}

export async function sendTransactionalEmail(payload: EmailPayload): Promise<EmailSendResult> {
  if (shouldDryRun()) {
    console.info('[ses] dry-run', {
      to: payload.to,
      subject: payload.subject,
    })

    return {
      delivered: false,
      dryRun: true,
    }
  }

  const fromEmail = process.env.SES_FROM_EMAIL
  if (!fromEmail) {
    throw new Error('SES_FROM_EMAIL is required when SES dry-run is disabled')
  }

  const input: SendEmailCommandInput = {
    FromEmailAddress: fromEmail,
    Destination: {
      ToAddresses: [payload.to],
    },
    Content: {
      Simple: {
        Subject: {
          Data: payload.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: payload.html,
            Charset: 'UTF-8',
          },
          Text: {
            Data: payload.text || payload.subject,
            Charset: 'UTF-8',
          },
        },
      },
    },
  }

  const response = await getSesClient().send(new SendEmailCommand(input))

  return {
    delivered: true,
    dryRun: false,
    messageId: response.MessageId,
  }
}
