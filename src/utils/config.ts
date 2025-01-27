import dotenv from 'dotenv'

type configType = {
  DATABASE_URL: string
  DATABASE_SSL_REJECT_UNAUTHORIZED: boolean
  NODE_ENV: string
  SCHEMA: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  API_KEY: string
}

function getConfigFromEnv(key: string, defaultValue?: string): string {
  const value = process.env[key]
  if (!value) {
    if (defaultValue) return defaultValue

    throw new Error(`${key} is undefined`)
  }
  return value
}

export function getConfig(): configType {
  dotenv.config()

  return {
    DATABASE_URL: getConfigFromEnv('DATABASE_URL'),
    DATABASE_SSL_REJECT_UNAUTHORIZED:
      getConfigFromEnv('DATABASE_SSL_REJECT_UNAUTHORIZED', String(true)) === String(true),
    SCHEMA: getConfigFromEnv('SCHEMA'),
    NODE_ENV: getConfigFromEnv('NODE_ENV'),
    STRIPE_SECRET_KEY: getConfigFromEnv('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: getConfigFromEnv('STRIPE_WEBHOOK_SECRET'),
    API_KEY: getConfigFromEnv('API_KEY'),
  }
}
