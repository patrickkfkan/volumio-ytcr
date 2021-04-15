'use strict'
const debug = require('debug')(`${require('../package.json').name}:error`)

const CODES = {
  /** 1 */
  NOT_LIST: 1,
  /** 2 */
  ARG: 2,
  /** 3 */
  PASSWORD: 3,
  /** 4 */
  PERMISSION: 4,
  /** 5 */
  UNKNOWN: 5,

  /** 50 */
  NO_EXIST: 50,
  /** 51 */
  PLAYLIST_MAX: 51,
  /** 52 */
  SYSTEM: 52,
  /** 53 */
  PLAYLIST_LOAD: 53,
  /** 54 */
  UPDATE_ALREADY: 54,
  /** 55 */
  PLAYER_SYNC: 55,
  /** 56 */
  EXIST: 56
}

const CODES_REVERSED = Object
  .keys(CODES)
  .reduce((memo, key) => ({ ...memo, [CODES[key]]: key }), {})

class MPDError extends Error {
  constructor (str, code, info) {
    super()
    debug('new error:', str)
    Error.captureStackTrace(this, this.constructor)

    // error response:
    // ACK [error@command_listNum] {current_command} message_text

    // parse error and command_listNum
    const errCode = str.match(/\[(.*?)\]/)
    this.name = 'MPDError'

    // safety fallback just in case
    if (!errCode || !errCode.length) {
      this.message = str
      this.code = code || str
    } else {
      const [error, cmdListNum] = errCode[1].split('@')
      const currentCommand = str.match(/{(.*?)}/)
      const msg = str.split('}')[1].trim()

      this.code = CODES_REVERSED[error] || '??'
      this.errno = error | 0
      this.message = msg
      this.cmd_list_num = cmdListNum | 0
      this.current_command = currentCommand[1]
    }

    if (info) {
      this.info = info
    }
  }
}

MPDError.CODES = CODES
MPDError.CODES_REVERSED = CODES_REVERSED

exports.MPDError = MPDError

exports.isError = responseLine => (responseLine + '').startsWith('ACK')
  ? new MPDError(responseLine)
  : null
