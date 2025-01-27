import { FastifyInstance } from 'fastify'
import { Server, IncomingMessage, ServerResponse } from 'http'
import { runMigrations } from './utils/migrate'
import { createServer } from './app'
import pino from 'pino'
import { getConfig } from './utils/config'
import { Client, ClientConfig } from 'pg'

const config = getConfig()

const logger = pino({
  formatters: {
    level(label) {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

const main = async () => {
  const app: FastifyInstance<Server, IncomingMessage, ServerResponse> = await createServer({
    logger,
    exposeDocs: process.env.NODE_ENV !== 'production',
    requestIdHeader: 'Request-Id',
  })

  // Init config
  const port = process.env.PORT || 8080

  // Init DB
  const dbConfig: ClientConfig = {
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    ssl: {
      rejectUnauthorized: config.DATABASE_SSL_REJECT_UNAUTHORIZED,
    },
  }
  const client = new Client(dbConfig)

  // Run migrations
  try {
    await client.connect()

    // Ensure schema exists, not doing it via migration to not break current migration checksums
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${config.SCHEMA};`)

    await runMigrations(client)
  } finally {
    await client.end()
  }

  // Start the server
  app.listen({ port: Number(port), host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    console.log(`Server listening at ${address}`)
  })
}

main()
