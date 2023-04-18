# YouTube Cast Receiver for Volumio

Plugin that enables Volumio to act a YouTube Cast receiver device. Supports casting from YouTube and YouTube Music.

# Changelog

1.0.0
- Add YouTube Music support
- Allow multiple connections
- Support manual pairing, aka Link with TV Code (YouTube only)
- Support playback of private videos and music

0.1.3
- Fix MPD connection
- Update dependency versions; replace deprecated `request` with `node-fetch`

0.1.2
- Improve fetching of audio URLs

0.1.1
- Check audio URLs and refetch on error response (retry up to 5 times)
- Minor change to loading of translations
- Update plugin for Volumio 3

0.1.0-b
- Version change to mark update of yt-cast-receiver module to version 0.1.1-b

0.1.0a-20210627
- Adapt to YouTube changes
- Really fix compatibility with Volumio 2.x
- Add 'Bind to Network Interface' setting

0.1.0a-20210620-2
- Fix compatibility with Volumio 2.x

0.1.0a-20210620
- Update yt-cast-receiver module

0.1.0a-20210419
- More robust transition from another service

0.1.0a-20210417
- Add livestream support

0.1.0a
- Initial release
