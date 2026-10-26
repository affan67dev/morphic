import postgres, { type TransactionSql } from 'postgres'
let connection: ReturnType<typeof postgres> | undefined
export function database() {
  if (!process.env.NOVA_DATABASE_URL)
    throw new Error('Project storage is temporarily unavailable.')
  return (connection ||= postgres(process.env.NOVA_DATABASE_URL, {
    ssl: 'require',
    max: 3,
    prepare: false,
    idle_timeout: 15,
    connect_timeout: 15
  }))
}
export async function owned<T>(
  userId: string,
  run: (sql: TransactionSql) => Promise<T>
): Promise<T> {
  return database().begin(async sql => {
    await sql`select set_config('nova.user_id', ${userId}, true)`
    return run(sql)
  }) as Promise<T>
}
