/// <reference types="node" />

import { NetConnectOpts, Socket } from 'net';
import { EventEmitter } from 'events';

declare const mpd: typeof MPD.Client;


export declare namespace MPD {

  export type Config = NetConnectOpts & {
    password?: string,
  }

  class Client extends EventEmitter {
    static connect(config?: MPD.Config): Promise<MPD.Client>;
    static MPDError: typeof MPDError;

    static Command: typeof Command;
    static cmd: typeof Command.cmd;

    static normalizeKeys: typeof Parsers.normalizeKeys;
    static autoparseValues: typeof Parsers.autoparseValues;

    static parseObject: typeof Parsers.parseObject;
    static parseList: Parsers.parseList;
    static parseNestedList: typeof Parsers.parseNestedList;
    static parseListAndAccumulate: typeof Parsers.parseListAndAccumulate;


    /**
     * Do not use directly, use mpd.connect(config) instead.
     */
    constructor (config?: MPD.Config);

    /**
     * Underlaying socket connected to MPD.
     * Available after connect.
     */
    socket: Socket;

    /**
     * Sends a MPD command string
     */
    sendCommand (command: string): Promise<string>;

    /**
     * Sends multiple MPD commands wrapped between command list begin and end
     * @example
     *  command_list_begin
     *  commands.join('\n')
     *  command_list_end
     *
     */
    sendCommands (commands: (string | Command)[]): Promise<string>;

    setupIdling (): void;
    stopIdling (): void;

    /**
     * Directly writes to socket connected to MPD
     */
    send(data: string): void;

    disconnect(): Promise<void>;
  }

  class MPDError extends Error {
    code: number;
    errno: MPDError.CODES;
    /**
     * Which command failed in case multiple commands were sent.
     * 0 for first (or only) command.
     */
    cmd_list_num: number;
    message: string;
    /**
     * Which command failed in case multiple commands were sent.
     */
    current_command: string;
    /**
     * Optional additional hint set by mpd2 itself.
     */
    info?: string;

    /**
     * Checks whether line represents MPD error line
     */
    static isError: (line: string) => boolean;
  }

  namespace MPDError {

    enum CODES {
      NOT_LIST = 1,
      ARG = 2,
      PASSWORD = 3,
      PERMISSION = 4,
      UNKNOWN = 5,
      NO_EXIST = 50,
      PLAYLIST_MAX = 51,
      SYSTEM = 52,
      PLAYLIST_LOAD = 53,
      UPDATE_ALREADY = 54,
      PLAYER_SYNC = 55,
      EXIST = 56
    }
  }

  class Command {
    constructor(name: string, args?: string[]);
    constructor(name: string, ...args: string[]);

    name: string;
    args: string[];

    /**
     * Helpful command for sending commands to MPD server.
     * Takes care of escaping arguments on protocol level.
     *
     * @example
     *  client.sendCommand(
     *    mpd.cmd('search', ['(artist contains "Empire")', 'group', 'album'])
     *  )
     */
    static cmd (name: string, args?: string[]): Command;

    /**
     * Helpful command for sending commands to MPD server.
     * Takes care of escaping arguments on protocol level.
     *
     * @example
     *  client.sendCommand(
     *    mpd.cmd('search', '(artist contains "Empire")', 'group', 'album')
     *  )
     */
    static cmd (name: string, ...args: string[]): Command;
  }

  namespace Parsers {
    type Delimiters = string | string[] | {[key: string]: string };

    /**
     * Whether parser functions format all keys into `snake_case` or not.
     * (MPD is not consistant in this aspect)
     * Default = true
     *
     * If `enabled` flag is omitted, method is used as a getter.
     */
    export const normalizeKeys: (enabled?: boolean) => boolean;

    /**
     * Whether to parse values for known keys (like bitrate, song ids, positions etc..)
     * Default = true
     *
     * If `enabled` flag is omitted, method is used as a getter.
     */
    export const autoparseValues: (enabled?: boolean) => boolean;

    /**
     * Alias to parseList(lines)[0]
     * @see mpd.parseList
     */
    export const parseObject: <T extends object>(line: string) => T;

    export interface parseList {

      /**
       * Parse lines, first key represents a distinct object if no delimiters are passed.
       *
       * @example
       * mpd.parseList(`
       * file: some/path
       * meta: meta
       * foo: bar
       * file: some/other/path
       * `) => [ {file: 'some/path', meta: 'meta', foo: 'bar'},
       *       { file: 'some/other/path }]
       *
       * @example
       *
       * // Pass delimiters in order to set distinct keys:
       * // (without 'playlist' delimiter, key-vals would be
       * // attached to frist file object):
       *
       * mpd.parseList(`
       * file: some/path
       * meta: meta
       * playlist: playlist name
       * modified: some-date
       * file: some/other/path
       * `, ['file', 'playlist']
       * ) => [ {file: 'some/path', meta: 'meta'},
       *        {playlist: 'playlist name', modified: 'some-date'},
       *        {file: 'some/other/path'}
       *     ]
       */
      <T extends object>(lines: string, delimiters?: Delimiters): T[];

      /**
       * "Currying" for @see parseList delimiters
       * @example
       * const playlistParser = mpd.parseList.by(['file', 'playlist'])
       * const playlists = playlistParser(<mpd response>)
       */
      by<T extends object>(delimiters?: Delimiters): <E extends object = T>(lines: string) => E[];
      /**
       * "Currying" for @see parseList delimiters
       * @example
       * const playlistParser = mpd.parseList.by('file', 'playlist')
       * const playlists = playlistParser(<mpd response>)
       */
      by<T extends object>(...delimiters: string[]): <E extends object = T>(lines: string) => E[];
    }

    /**
     * Parse the list, first item key indicates
     * the unique key identifier, any subtiems
     * will be nested within that object.
     *
     *
     * @example
     * mpd.parseNestedList(`
     * artist: foo
     * album: foo
     * title: bar
     * title: fox
     * title: jumps
     * album: crazy
     * title: mind
     * artist: cactus
     * ablum: cactusalbum
     * title: bull
     * `)
     * // returns
     * [ { artist: 'foo',
     *     album:
     *      [ { album: 'foo',
     *          title:
     *           [ { title: 'bar' },
     *             { title: 'fox' },
     *             { title: 'jumps' },
     *             { title: 'mind' } ] },
     *        { album: 'crazy' } ] },
     *   { artist: 'cactus',
     *     ablum: [ { ablum: 'cactusalbum', title: [ { title: 'bull' } ] } ] } ]
     */
    export const parseNestedList: <T extends object>(lines: string) => T[];

    /**
     * Usefull for commands:
     *  `listallinfo` - parseListAndAccumulate(['directory', 'file'])(lines)
     *  `decoders` - parseListAndAccumulate(['plugin'])(lines)
     *
     * @example
     * mpd.parseListAndAccumulate(['directory', 'file'])(`
     * directory: foo
     * file: bar
     * something: else
     * file: fox
     * meta: atem
     * title: cool song
     * fileblah: fileblah
     * filenlahmeta: fbm
     * filenlahmeta: same keys as array
     * directory: bar
     * file: hello
     * title: hello song
     * `)
     * // returns
     * [ { directory: 'foo',
     *     file:
     *      [ { file: 'bar', something: 'else' },
     *        { file: 'fox',
     *          meta: 'atem',
     *          title: 'cool song',
     *          fileblah:
     *           [ { fileblah: 'fileblah',
     *               filenlahmeta: [ 'fbm', 'same keys as array' ] } ] } ] },
     *   { directory: 'bar',
     *     file: [ { file: 'hello', title: 'hello song' } ] } ]
     */
    export const parseListAndAccumulate: <T extends object>(path: string[]) =>
      <E extends object = T>(lines: string) => E[];
  }

}

export default mpd;
