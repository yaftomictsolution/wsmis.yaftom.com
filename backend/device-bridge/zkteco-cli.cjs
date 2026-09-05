'use strict'

const readline = require('node:readline')

function result(payload) {
  process.stdout.write(`WSMIS_RESULT:${JSON.stringify(payload)}\n`)
}

function errorMessage(error) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    if (error.err instanceof Error) return error.err.message
    if (typeof error.message === 'string') return error.message
    if (typeof error.err === 'string') return error.err
  }
  return String(error || 'Unknown device error')
}

function cleanUser(user) {
  return {
    uid: user?.uid ?? null,
    userId: user?.userId == null ? null : String(user.userId),
    name: user?.name == null ? null : String(user.name),
    cardNumber: user?.cardno == null ? null : String(user.cardno),
    role: user?.role ?? null,
  }
}

function cleanPunch(punch) {
  return {
    deviceUserId: punch?.deviceUserId == null ? null : String(punch.deviceUserId),
    userSn: punch?.userSn ?? null,
    recordTime: punch?.recordTime instanceof Date ? punch.recordTime.toISOString() : punch?.recordTime,
  }
}

async function optional(call) {
  try { return await call() } catch { return null }
}

async function main(config) {
  const sdk = require('zk-attendance-sdk')
  const ZKAttendanceClient = sdk.default || sdk
  const timeout = Math.max(2000, Math.min(30000, Number(config.timeoutMs || 8000)))
  const client = new ZKAttendanceClient(
    String(config.ip),
    Number(config.port || 4370),
    timeout,
    undefined,
    { warn: () => undefined, error: () => undefined },
  )

  try {
    await client.createSocket()
    const information = await optional(() => client.getInfo())
    const details = {
      connectionType: client.getConnectionType(),
      serialNumber: await optional(() => client.getSerialNumber()),
      deviceName: await optional(() => client.getDeviceName()),
      firmwareVersion: await optional(() => client.getDeviceVersion()),
      platform: await optional(() => client.getPlatform()),
      deviceTime: await optional(() => client.getTime()),
      userCount: information?.userCounts ?? null,
      logCount: information?.logCounts ?? null,
      logCapacity: information?.logCapacity ?? null,
    }

    if (config.operation === 'test') {
      return { ok: true, details }
    }

    if (config.operation !== 'pull') {
      throw new Error('Unsupported bridge operation.')
    }

    const usersResult = await client.getUsers()
    const punchesResult = await client.getAttendances()
    return {
      ok: true,
      details,
      users: Array.isArray(usersResult?.data) ? usersResult.data.map(cleanUser) : [],
      punches: Array.isArray(punchesResult?.data) ? punchesResult.data.map(cleanPunch) : [],
    }
  } finally {
    try { await client.disconnect() } catch { /* read-only connection is already closed */ }
  }
}

const lines = []
const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
input.on('line', (line) => lines.push(line))
input.on('close', async () => {
  try {
    const config = JSON.parse(lines.join('\n'))
    result(await main(config))
  } catch (error) {
    result({ ok: false, error: errorMessage(error) })
    process.exitCode = 1
  }
})
