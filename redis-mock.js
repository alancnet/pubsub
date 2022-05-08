import EventEmitter from 'events'
import micromatch from 'micromatch'

let store = {}
/** @type {Record<string, Set<RedisMock>>} */
const channels = {}

const sleep = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * @class
 * @augments import('redis').RedisClient
 */
export default class RedisMock extends EventEmitter {
  constructor () {
    super()
    /** @type {Record<string, Function>} */
    this._pCallbacks = {}
    /** @type {Record<string, Function>} */
    this._callbacks = {}
    setImmediate(() => {
      this.emit('connect')
      this.emit('ready')
    })

    /**
     * Represents the in-memory Redis store
     *
     * @type {Object<string,string>}
     */
    this.$store = store
  }

  async connect () {
    await sleep()
  }

  async rateLimit () {
    await sleep()
    return 10
  }

  async get (key) {
    await sleep()
    let result = this.$store[key] || null
    if (result?.expires && result.expires < Date.now()) {
      // Expired
      delete this.$store[key]
      result = null
    }
    return result?.value || null
  }

  async set (key, value, opts = {}) {
    await sleep()
    let expires = null
    if (opts.XX && !(key in this.$store)) {
      // Update only and it doesn't exist
      return false
    }
    if (opts.NX && key in this.$store) {
      // Insert only and it already exists
      return false
    }
    // PX sets an expiration, but this mock shouldn't live that long.
    if (opts.PX) {
      expires = opts.PX
    }
    if (opts.KEEPTTL && key in this.$store) {
      expires = this.$store[key].expires || expires
    }
    this.$store[key] = {
      value,
      expires: expires ? Date.now() + parseInt(expires) : null
    }
    return true
  }

  async del (key) {
    await sleep()
    const exists = key in this.$store
    delete this.$store[key]
    return exists
  }

  subscribe (name, cb) {
    if (this._callbacks[name]) {
      throw new Error(`Already subscribed to ${name}`)
    }
    this._callbacks[name] = cb
    if (!channels[name]) channels[name] = new Set()
    channels[name].add(this)
  }

  pSubscribe (name, cb) {
    if (this._pCallbacks[name]) {
      throw new Error(`Already subscribed to ${name}`)
    }
    this._pCallbacks[name] = cb
    if (!channels[name]) channels[name] = new Set()
    channels[name].add(this)
  }

  unsubscribe (name) {
    delete this._callbacks[name]
    if (channels[name]) {
      channels[name].delete(this)
      if (!channels[name].size) delete channels[name]
    }
  }

  pUnsubscribe (name) {
    delete this._pCallbacks[name]
    if (channels[name]) {
      channels[name].delete(this)
      if (!channels[name].size) delete channels[name]
    }
  }

  publish (name, message, cb) {
    for (const key in channels) {
      if (micromatch.isMatch(name, key)) {
        for (const client of channels[key]) {
          if (client._callbacks[key]) {
            client._callbacks[key](message)
          }
          if (client._pCallbacks[key]) {
            client._pCallbacks[key](message, name)
          }
        }
      }
    }
  }
}
