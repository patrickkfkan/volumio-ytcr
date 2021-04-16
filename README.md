# YouTube Cast Receiver for Volumio

A plugin that enables Volumio to act as a cast device for the YouTube mobile app or website. The plugin will playback the audio streams of videos casted to it.

>Not all browsers support casting from the YouTube website. The plugin has been tested to work with the Chrome and Edge desktop browsers.

## Getting Started

To install the plugin, first make sure you have [enabled SSH access](https://volumio.github.io/docs/User_Manual/SSH.html) on your Volumio device. Then, in a terminal:

```
$ ssh volumio@<your_Volumio_address>

volumio:~$ mkdir ytcr-plugin
volumio:~$ cd ytcr-plugin
volumio:~/ytcr-plugin$ git clone https://github.com/patrickkfkan/volumio-ytcr.git
volumio:~/ytcr-plugin$ cd volumio-ytcr
volumio:~/ytcr-plugin/volumio-ytcr$ volumio plugin install

...
Progress: 100
Status :YouTube Cast Receiver Successfully Installed, Do you want to enable the plugin now?
...

// If the process appears to hang at this point, just press Ctrl-C to return to the terminal.
```

Now access Volumio in a web browser. Go to ``Plugins -> Installed plugins`` and enable the YouTube Cast Receiver plugin by activating the switch next to it.

With the plugin enabled, you can now begin casting:

1. Ensure your phone or computer is on the same network as your Volumio device.
2. Select the Cast button in the YouTube mobile app or website.
3. Choose your Volumio device.
4. Select a video or playlist for playback. Volumio should now play it.
5. Control playback through the mobile app or website.

## Updating

When a new version of the plugin becomes available, you can ssh into your Volumio device and update as follows (assuming you have not deleted the directory which you cloned from this repo):

```
volumio:~$ cd ~/ytcr-plugin
volumio:~/ytcr-plugin$ rm -rf volumio-ytcr
volumio:~/ytcr-plugin$ git clone https://github.com/patrickkfkan/volumio-ytcr.git
volumio:~/ytcr-plugin$ cd volumio-ytcr
volumio:~/ytcr-plugin/volumio-ytcr$ volumio plugin update

This command will update the plugin on your device
...
Progress: 100
Status :Successfully updated plugin

// If the process appears to hang at this point, just press Ctrl-C to return to the terminal.

volumio:~/ytcr-plugin/volumio-ytcr$ sudo systemctl restart volumio
```
## Volumio 2.x

The plugin uses [MPD](https://www.musicpd.org/) for playing a video's audio stream. Volumio version 2.x ships with a *really* outdated version of MPD that is not entirely compatible with these streams. So, while a stream will still play, you will likely encounter the following:

1. Playback abruptly ends at ~3/4 into the stream.
2. Seeking is not possible at all.

Volumio 2.x users can [update their MPD](https://community.volumio.org/t/mpd-0-21-16-for-volumio-arm-armv7-and-x86/11554) so that the streams can be played normally. Note that this update is not officially endorsed and there is no guarantee that it will not break certain aspects of Volumio - use at own risk.

Volumio 3.x ships with a recent version of MPD, and so does not have to be updated.

# Notes

- Only public videos can be played. Private (even owned by you) and regionally restricted videos will fail to load.
- The YouTube website is less featured than the YouTube mobile app as far as casting is concerned:
    - Autoplay is not supported
    - Videos added manually to the queue are not visible to the plugin, and so will not be played.
- The plugin tries to keep connections alive, even when nothing is being casted. Despite so, a connected client (YouTube app or website) may still decide to disconnect.
- This plugin is work-in-progress. Do not expect it to be bug-free. If you come across an issue, you can report it on Github or in the [Volumio forums](https://community.volumio.org/). The latter is preferred because more people will see it and can report their findings too.


# Changelog

0.1.0a
- Initial release
