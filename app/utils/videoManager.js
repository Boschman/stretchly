import EventEmitter from 'events'
import log from 'electron-log/main.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const asyncExecFile = promisify(execFile)
// Display sleep assertions held during playback, e.g. Firefox "video-playing" or Chrome "Video Wake Lock"
const videoAssertion = /pid (\d+)\(.*\): .* (?:PreventUserIdleDisplaySleep|NoDisplaySleepAssertion) named: "[^"]*(?:video|playback)[^"]*"/gi

export function videoAssertionPids (assertions) {
  return [...assertions.matchAll(videoAssertion)].map(match => Number(match[1]))
}

class VideoManager extends EventEmitter {
  constructor (settings) {
    super()
    this.settings = settings
    this.timer = null
    this.isOnVideo = false
    this.hasLoggedError = false
    if (settings.get('canPauseForVideo')) {
      this.start()
    }
  }

  start () {
    if (this.timer || process.platform !== 'darwin') return
    this.timer = setInterval(() => this._checkVideo(), this.settings.get('videoCheckInterval'))
    log.info('Stretchly: starting video monitoring')
  }

  stop () {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
    this.isOnVideo = false
    log.info('Stretchly: stopping video monitoring')
  }

  async _isVideoPlaying () {
    try {
      const pids = videoAssertionPids(await this._assertions())
      return pids.length > 0 && pids.includes(await this._frontmostAppPid())
    } catch (e) {
      if (!this.hasLoggedError) {
        log.error('Stretchly: video detection error:', e)
        this.hasLoggedError = true
      }
      return false
    }
  }

  async _assertions () {
    const { stdout } = await asyncExecFile('pmset', ['-g', 'assertions'])
    return stdout
  }

  async _frontmostAppPid () {
    const { stdout: asn } = await asyncExecFile('lsappinfo', ['front'])
    const { stdout: info } = await asyncExecFile('lsappinfo', ['info', '-only', 'pid', asn.trim()])
    return Number(info.match(/pid = (\d+)/)?.[1])
  }

  async _checkVideo () {
    const isVideoPlaying = await this._isVideoPlaying()
    if (!this.timer) return
    if (isVideoPlaying) {
      this.isOnVideo = true
      this.emit('videoPlaying')
    } else if (this.isOnVideo) {
      this.isOnVideo = false
      this.emit('videoFinished')
    }
  }
}

export default VideoManager
