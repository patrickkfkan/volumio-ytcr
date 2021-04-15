'use strict'
const { escapeArg } = require('./parsers')

class Command {
  constructor (name, ...args) {
    if (args.length === 1 && args[0] instanceof Array) {
      args = args[0]
    }
    this.name = name
    this.args = args
    this.toString = this.toString.bind(this)
  }

  static cmd (name, ...args) {
    if (args.length === 1) {
      return new Command(name, args[0])
    }
    args = [null, name].concat(args)
    return new (Command.constructor.bind.apply(Command, args))()
  }

  toString () {
    const escaped = this.args.map(escapeArg).join(' ')
    return `${this.name} ${escaped}`
  }
}

exports.Command = Command
