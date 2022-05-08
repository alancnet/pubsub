import WebSocket from 'ws'

export default class Client {
  constructor (url, options = {reconnect: true, delay: 1000}) {
    this.url = url
    this.options = options
    this.reconnectTimer = null
    this.subscriptions = new Map()
    this.publishQueue = []
  }
  async reconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, this.options.delay)
  }
  async connect () {
    this.ws = new WebSocket(this.url)
    this.ws.on('open', () => {
      console.log('open', this.subscriptions)
      // Resubscribe to existing subscriptions
      this.subscriptions.forEach((callbacks, channel) => {
        callbacks.forEach(callback => {
          this.ws.send(JSON.stringify({
            type: 'subscribe',
            channel
          }))
        })
      })

      // Publish queued messages
      this.publishQueue.forEach(({channel, data}) => {
        this.ws.send(JSON.stringify({
          type: 'publish',
          channel,
          data
        }))
      })
      this.publishQueue = []

      this.ws.on('message', msg => {
        const data = JSON.parse(msg)
        switch (data.type) {
          case 'ping':
            this.ws.send(JSON.stringify({
              type: 'pong'
            }))
            break
          case 'message':
            {
              const { channel, data: data2 } = data
              if (this.subscriptions.has(channel)) {
                this.subscriptions.get(channel).forEach(cb => cb(data2))
              }
              break
            }
          case 'error':
            console.log('error', data.message)
            break
        }
      })
      this.ws.on('close', () => {
        console.log('close')
        if (this.options.reconnect) this.reconnect()
      })
      this.ws.on('error', (err) => {
        console.log('error', err)
        if (this.options.reconnect) this.reconnect()
      })
    })
  }

  subscribe(channel, callback) {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set())
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          channel
        }))
      }
    }
    this.subscriptions.get(channel).add(callback)
    return () => {
      this.subscriptions.get(channel).delete(callback)
      if (!this.subscriptions.get(channel).size) {
        this.subscriptions.delete(channel)
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'unsubscribe',
            channel
          }))
        }
      }
    }
  }

  publish(channel, data) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'publish',
        channel,
        data
      }))
    } else {
      this.publishQueue.push({
        channel,
        data
      })
    }
  }

}