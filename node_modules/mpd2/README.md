## node mpd client

Connect to a [Music Player Daemon](https://musicpd.org) ([GIT](https://github.com/MusicPlayerDaemon/MPD)) server, send commands, emit events.

This is a rewrite of [mpd.js module](https://github.com/andrewrk/mpd.js) to promise based methods and support for parsing of various MPD responses.

For higher level API module check out [mpd-api](https://github.com/cotko/mpd-api).

### Usage

  ```
  npm i / yarn mpd2
  ```

  ```js
  const mpd = require('mpd2')
  const { cmd } = mpd

  // config is passed to net.connect()
  const config = {
    host: 'localhost',
    port: 6600,

    // if connecting to a local socket rather than
    // host and port; trailing `~` is replaced by
    // `os.homedir()`
    // path: '~/.config/mpd/socket'

    // if MPD requires a password, pass
    // it within the config as well:
    //password: 'password'
  }

  const client = await mpd.connect(config)

  // without config will default to `localhost:6600`
  // const client = await mpd.connect()


  const status = await client.sendCommand('status').then(mpd.parseObject)
  console.log(status)

  client.on('close', () => {
    console.log('client connection closed')
  })

  client.on('system', name => {
    console.log('on system event: %s', name)
  })

  client.on('system-player', () => {
    console.log('on system player event')
  })

  await client.disconnect()

  ```

  ```ts

  // typings included

  import mpd, { MPD } from 'mpd2'

  type Status = {
    volume: number
    repeat: boolean
    playlist: number
    state: 'play' | 'stop' | 'pause'
    // ...
  }

  type ListAllInfo = {
    directory: string
    last_modified: string
    file?: File[]
  }

  type File = {
    file: string
    last_modified: string
    format: string
    time: number
    artist: string
    title: string
    // ...
  }

  const client: MPD.Client = await mpd.connect()

  const statusString = await client.sendCommand('status')
  const status = mpd.parseObject<Status>(statusString)

  console.log('state:', status.state)

  const lsAllParser = mpd.parseListAndAccumulate<ListAllInfo>(['directory', 'file'])
  const lsAllString = await client.sendCommand('listallinfo')
  const lsAll = lsAllParser(lsAllString)
  console.log('first directory: %s, files: %o', lsAll[0].directory, lsAll[0].file)

  try {

    await client.sendCommands([
      'status',
      mpd.cmd('foo', 'bar')
    ])
  } catch (e) {
    const err: MPD.MPDError = e

    switch (err.errno) {
      case mpd.MPDError.CODES.UNKNOWN:
        console.log('command does not exist')
        break;
      default:
        console.log('some other error', err)
        break;
    }
  }

  ```

### Documentation

  See also the [MPD Protocol Documentation](https://www.musicpd.org/doc/html/protocol.html).

#### Client methods

* #### *async* client.sendCommand(command)

  `command` can be a `MpdClient.Command` or a string, use *mpd.cmd* helper to construct the Command when using arguments:
  ```js
  
  await client.sendCommand(mpd.cmd('setvol', [50]))
  
  // args can be overloaded as well, no need to pass them as array:
  const searched = await client.sendCommand(
    mpd.cmd('search', '(artist contains "Empire")', 'group', 'album'))
  
  ```

* #### *async* client.sendCommands(commandList)
  `commandList` will be wrapped between `command_list_begin` and `command_list_end` (see MPD documentation for more info)

* #### *async* client.disconnect()

  Disconnects the client.

##### Static functions

* #### *async* mpd.connect(options)

  Connects to a MPD server and returns a client.
  
* #### mpd.cmd(name, [args]) or overloaded *mpd.cmd(name, ...args)*

  Convert name/args pair into a Command.


###### Parsers

* #### mpd.normalizeKeys([bool])
  Getter / setter to enable normalization of keys while parsing. MPD responses contains various keys, upper/lower/kebap cases, this setting normalizes all keys into *snake_case*.
  
  Turned on by default
  
* #### mpd.autoparseValues([bool])
  Getter / setter to enable auto parsing of known values based on keys.
  
  Turned on by default

* #### mpd.parseObject(msg)

  `msg`: a string which contains an MPD response.
  Returns an object.

* #### mpd.parseList(msg, [delimiters])

  `msg`: a string which contains an MPD response.
  `delimiters`: which keys represent distinct object types within the response
  
  Returns an array, see source for more info

* #### mpd.parseList.by(delimiters)

  `delimiters`: a string or array of delimiters
  
  returns wrapped function `parser(msg)` which calls `parseList(msg, delimiters)`
  
  ```js
  const songparser = mpd.parseList.by('file')
  await client.sendCommand('listallinfo').then(songparser)
  ```

* #### mpd.parsNestedList(msg)

  `msg`: a string which contains an MPD response.
  
  Parse the list response, first item key indicates the unique key identifier, any subtiems will be nested within that object. Returns an array of parsed objects. See source for more info.

* #### mpd.parseListAndAccumulate(msg, path)

  `msg`: a string which contains an MPD response.
  `path`: array of nested objects
  
  Parse the list response and nest objects based on *path*. See source for more info.

#### Events

* #### close

  The connection is closed.

* #### system(systemName)

  A system has updated. `systemName` is one of:

  * `database` - the song database has been modified after update.
  * `update` - a database update has started or finished. If the database was
    modified during the update, the database event is also emitted.
  * `stored_playlist` - a stored playlist has been modified, renamed, created
    or deleted
  * `playlist` - the current playlist has been modified
  * `player` - the player has been started, stopped or seeked
  * `mixer` - the volume has been changed
  * `output` - an audio output has been enabled or disabled
  * `options` - options like repeat, random, crossfade, replay gain
  * `sticker` - the sticker database has been modified.
  * `subscription` - a client has subscribed or unsubscribed to a channel
  * `message` - a message was received on a channel this client is subscribed
    to; this event is only emitted when the queue is empty

* #### system-*

  See above event. Each system name has its own event as well.

#### Properties

* #### client.PROTOCOL_VERSION

  Protocol version returned by the MPD server after connection is established

* #### mpd.MPDError

  *MPDError.CODES* contains ACK codes map, as seen here [Ack.hxx](https://github.com/MusicPlayerDaemon/MPD/blob/master/src/protocol/Ack.hxx)

  ```js
  MPDError.CODES = {
    NOT_LIST: 1,
    ARG: 2,
    PASSWORD: 3,
    PERMISSION: 4,
    UNKNOWN: 5,

    NO_EXIST: 50,
    PLAYLIST_MAX: 51,
    SYSTEM: 52,
    PLAYLIST_LOAD: 53,
    UPDATE_ALREADY: 54,
    PLAYER_SYNC: 55,
    EXIST: 56
  }
  ```
  
  All errors thrown by MPD are converted into MPDError isntance:
  ```js
  // MPD ACK line looks like
  'ACK [error@command_listNum] {current_command} message_text'
  
  err.code = 'ARG' // one of CODES
  err.errno = 2 // for CODES.ARG
  err.message = 'whatever mpd returned'
  err.cmd_list_num = x // whatever MPD returned as listNum found in MPD ACK line
  err.current_command = 'which command this error relates to' // found by MPD ACK line
  ```


