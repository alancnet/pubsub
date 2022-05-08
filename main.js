import express from 'express'
import expressWs from 'express-ws'
import { server } from 'pubsub'

const app = express()
expressWs(app)

app.ws('', server)

app.listen(6580, () => {
  console.log('Listening')
})
