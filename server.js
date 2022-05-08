import RedisMock from './redis-mock.js'
import { getLogger } from './logging.js'

const logger = getLogger('pubsub-server')
let mock = null

const subscriptions = new Map()
function subscribe(channel, callback) {
  if (!mock) {
    mock = new RedisMock()
  }
  if (!subscriptions.has(channel)) {
    subscriptions.set(channel, new Set())
    mock.subscribe(channel, msg => {
      subscriptions.get(channel).forEach(cb => cb(JSON.parse(msg)))
    })
  }
  subscriptions.get(channel).add(callback)
  return () => {
    subscriptions.get(channel).delete(callback)
    if (!subscriptions.get(channel).size) {
      subscriptions.delete(channel)
      mock.unsubscribe(channel)
    }
  }
}


export default function(ws, req) {
  if (!mock) {
    mock = new RedisMock()
  }
  logger.info(`New connection from ${req.connection.remoteAddress}`)
  const send = data => ws.send(JSON.stringify(data))

  const unsubscribers = new Map()

  ws.on('message', (msg) => {
    logger.trace(`Received message: ${msg}`)
    const data = JSON.parse(msg)
    switch (data.type) {
      case 'ping':
        logger.trace(`Sending pong`)
        send({ type: 'pong' })
        break
      case 'subscribe':
        {
          const { channel } = data
          logger.info(`Client subscribed to ${channel}`)
          if (!unsubscribers.has(channel)) {
            unsubscribers.set(channel, subscribe(channel, data => {
              send({
                type: 'message',
                channel,
                data
              })
            }))
          }
          break
        }
      case 'unsubscribe':
        {
          const { channel } = data
          logger.info(`Client unsubscribed from ${channel}`)
          if (unsubscribers.has(channel)) {
            unsubscribers.get(channel)()
            unsubscribers.delete(channel)
          }
          break
        }
      case 'publish':
        {
          const { channel, data: data2 } = data
          const json = JSON.stringify(data2)
          logger.trace(`Publishing to ${channel}:`, json)
          mock.publish(channel, json)
          break
        }
      default:
        throw new Error(`Unknown message type: ${data.type}`)
    }
  })

  ws.on('error', (err) => {
    logger.error(`Error: ${err}`)
  })

  ws.on('close', () => {
    logger.info(`Connection closed`)
    unsubscribers.forEach(unsubscribe => unsubscribe())
    unsubscribers.clear()
  })
}