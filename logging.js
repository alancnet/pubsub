import Log4js from 'log4js'

export const logLevels = ['all', 'trace', 'debug', 'info', 'warn', 'error', 'fatal', 'mark', 'off']
/** @typedef {'all'|'trace'|'debug'|'info'|'warn'|'error'|'fatal'|'mark'|'off'} LogLevel */

let logLevel = process.env.LOG_LEVEL || 'info'
if (!logLevels.includes(logLevel)) {
  console.warn(`Invalid log level: ${logLevel}. Valid levels are: ${logLevels.join(', ')}.`)
  logLevel = 'info'
}

const log4js = Log4js.configure({
  appenders: {
    out: {
      type: 'stdout'
    }
  },
  categories: {
    default: {
      appenders: ['out'],
      level: logLevel
    }
  }
})

export function getLogger (name) {
  return log4js.getLogger(name)
}
