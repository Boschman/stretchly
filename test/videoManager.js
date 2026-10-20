import { vi } from 'vitest'
import 'chai/register-should'
import { join } from 'path'
import VideoManager, { hasVideoAssertion } from '../app/utils/videoManager'
import Store from 'electron-store'
import defaultSettings from '../app/utils/defaultSettings'
import { rm } from 'node:fs/promises'

const assertion = (type, name) => `   pid 3584(firefox): [0x00009cc20005a147] 00:00:33 ${type} named: "${name}"  \n`

describe('videoManager', function () {
  it('detects display sleep assertions of video playback', () => {
    hasVideoAssertion(assertion('NoDisplaySleepAssertion', 'video-playing')).should.equal(true)
    hasVideoAssertion(assertion('PreventUserIdleDisplaySleep', 'Video Wake Lock')).should.equal(true)
    hasVideoAssertion(assertion('PreventUserIdleDisplaySleep', 'media playback')).should.equal(true)
  })

  it('ignores audio playback and other display sleep assertions', () => {
    hasVideoAssertion(assertion('NoIdleSleepAssertion', 'audio-playing')).should.equal(false)
    hasVideoAssertion(assertion('PreventUserIdleSystemSleep', 'media playback')).should.equal(false)
    hasVideoAssertion(assertion('PreventUserIdleDisplaySleep', 'Electron')).should.equal(false)
    hasVideoAssertion('   PreventUserIdleDisplaySleep    1\n').should.equal(false)
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
