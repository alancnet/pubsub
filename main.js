import express from 'express'
import expressWs from 'express-ws'
import server from './server.js'

const app = express()
expressWs(app)

app.ws('', server)

const port = parseInt(process.env.PORT || 6580)

app.once('error', err => {
  console.log('error', err)
  process.exit(1)
})
app.listen(port, () => {
  console.log(`Listening on ws://0.0.0.0:${port}`)
})
