import RedisMock from './redis-mock.js'

let mock = null

const subscriptions = new Map()
function subscribe(channel, callback) {
  if (!mock) {
    mock = new RedisMock()
  }
  if (!subscriptions.has(channel)) {
    subscriptions.set(channel, new Set())
    mock.subscribe(channel, msg => {
      subscriptions.get(channel).forEach(cb => cb(msg))
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
  const send = data => ws.send(JSON.stringify(data))

  const unsubscribers = new Map()

  ws.on('message', (msg) => {
    console.log('Received:', msg)
    const data = JSON.parse(msg)
    switch (data.type) {
      case 'ping':
        send({ type: 'pong' })
        break
      case 'subscribe':
        {
          const { channel } = data
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
          if (unsubscribers.has(channel)) {
            unsubscribers.get(channel)()
            unsubscribers.delete(channel)
          }
          break
        }
      case 'publish':
        {
          const { channel, data: data2 } = data
          mock.publish(channel, data2)
          break
        }
      default:
        throw new Error(`Unknown message type: ${data.type}`)
    }
  })
}