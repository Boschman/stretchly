import { vi } from 'vitest'
import 'chai/register-should'
import { join } from 'path'
import VideoManager, { videoAssertionPids } from '../app/utils/videoManager'
import Store from 'electron-store'
import defaultSettings from '../app/utils/defaultSettings'
import { rm } from 'node:fs/promises'

const firefox = 3584
const chrome = 6305
const assertion = (type, name, pid = firefox, app = 'firefox') => `   pid ${pid}(${app}): [0x00009cc20005a147] 00:00:33 ${type} named: "${name}"  \n`

describe('videoManager', function () {
  it('finds the apps holding display sleep assertions of video playback', () => {
    videoAssertionPids(assertion('NoDisplaySleepAssertion', 'video-playing')).should.deep.equal([firefox])
    videoAssertionPids(assertion('PreventUserIdleDisplaySleep', 'media playback')).should.deep.equal([firefox])
    videoAssertionPids(
      assertion('NoDisplaySleepAssertion', 'video-playing') +
      assertion('NoDisplaySleepAssertion', 'Video Wake Lock', chrome, 'Google Chrome')
    ).should.deep.equal([firefox, chrome])
  })

  it('ignores audio playback and other display sleep assertions', () => {
    videoAssertionPids(assertion('NoIdleSleepAssertion', 'audio-playing')).should.deep.equal([])
    videoAssertionPids(assertion('PreventUserIdleSystemSleep', 'media playback')).should.deep.equal([])
    videoAssertionPids(assertion('PreventUserIdleDisplaySleep', 'Electron')).should.deep.equal([])
    videoAssertionPids('   PreventUserIdleDisplaySleep    1\n').should.deep.equal([])
  })

  it('only counts a video playing in the frontmost app', async () => {
    const videoManager = new VideoManager({ get: () => false })
    vi.spyOn(videoManager, '_assertions').mockResolvedValue(assertion('NoDisplaySleepAssertion', 'video-playing'))
    const frontmostAppPid = vi.spyOn(videoManager, '_frontmostAppPid')
    frontmostAppPid.mockResolvedValue(firefox)
    const isPlayingInFront = await videoManager._isVideoPlaying()
    frontmostAppPid.mockResolvedValue(chrome)
    const isPlayingInBackground = await videoManager._isVideoPlaying()
    isPlayingInFront.should.equal(true)
    isPlayingInBackground.should.equal(false)
    vi.restoreAllMocks()
  })

  describe('monitoring', function () {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    let settings = null
    let videoManager = null
    let isVideoPlaying = false

    const createVideoManager = (platformName) => {
      Object.defineProperty(process, 'platform', { value: platformName })
      videoManager = new VideoManager(settings)
    }

    beforeEach(() => {
      vi.useFakeTimers()
      vi.spyOn(VideoManager.prototype, '_isVideoPlaying').mockImplementation(async () => isVideoPlaying)
      settings = new Store({
        cwd: join(__dirname),
        name: 'test-settings-videoManager',
        defaults: defaultSettings
      })
      isVideoPlaying = false
    })

    it('emits videoPlaying while a video plays and videoFinished once it stops', async () => {
      createVideoManager('darwin')
      const emitted = []
      for (const eventName of ['videoPlaying', 'videoFinished']) {
        videoManager.on(eventName, () => emitted.push(eventName))
      }
      const interval = settings.get('videoCheckInterval')
      isVideoPlaying = true
      await vi.advanceTimersByTimeAsync(interval * 2)
      videoManager.isOnVideo.should.equal(true)
      isVideoPlaying = false
      await vi.advanceTimersByTimeAsync(interval * 2)
      emitted.should.deep.equal(['videoPlaying', 'videoPlaying', 'videoFinished'])
      videoManager.isOnVideo.should.equal(false)
    })

    it('does not monitor when turned off', () => {
      settings.set('canPauseForVideo', false)
      createVideoManager('darwin')
      videoManager.should.have.property('timer', null)
    })

    it('does not monitor outside macOS', () => {
      createVideoManager('linux')
      videoManager.should.have.property('timer', null)
    })

    afterEach(async () => {
      videoManager.stop()
      videoManager = null
      Object.defineProperty(process, 'platform', platform)
      vi.restoreAllMocks()
      vi.useRealTimers()
      await rm(join(__dirname, '/test-settings-videoManager.json'), { force: true })
      settings = null
    })
  })
})
