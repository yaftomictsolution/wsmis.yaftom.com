const { createServer } = require('node:http')
const next = require('next')

const port = Number(process.env.PORT || 3000)
const hostname = process.env.HOST || process.env.APP_HOST || '127.0.0.1'
const app = next({
  dev: false,
  dir: __dirname,
  hostname,
  port,
})
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer((request, response) => handle(request, response))
    .listen(port, hostname)
}).catch((error) => {
  console.error('Failed to start WSMIS under Passenger.', error)
  process.exit(1)
})
