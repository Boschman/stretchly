import { vi } from 'vitest'
import 'chai/register-should'
import { join } from 'path'
import BreaksPlanner from '../app/breaksPlanner'
import NaturalBreaksManager from '../app/utils/naturalBreaksManager'
import VideoManager from '../app/utils/videoManager'
import Store from 'electron-store'
import defaultSettings from '../app/utils/defaultSettings'
import { rm } from 'node:fs/promises'

describe('breaksPlanner', function () {
  const interval = 1000
  const videoCheckInterval = 100
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')
  let settings = null
  let breaksPlanner = null
  let idleTime = 0
  let isVideoPlaying = false
  let emitted = []

  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    vi.spyOn(NaturalBreaksManager.prototype, 'idleTime', 'get').mockImplementation(() => idleTime)
    vi.spyOn(VideoManager.prototype, '_isVideoPlaying').mockImplementation(async () => isVideoPlaying)
    idleTime = 0
    isVideoPlaying = false
    settings = new Store({
      cwd: join(__dirname),
      name: 'test-settings-breaksPlanner',
      defaults: defaultSettings
    })
    settings.set({
      microbreakInterval: interval,
      breakInterval: 1,
      microbreakNotification: false,
      breakNotification: false,
      monitorDnd: false,
      breakIdleThreshold: 60000,
      videoCheckInterval
    })
    breaksPlanner = new BreaksPlanner(settings)
    emitted = []
    for (const eventName of ['startMicrobreak', 'startMicrobreakNotification', 'startBreak', 'updateToolTip']) {
      breaksPlanner.on(eventName, () => emitted.push(eventName))
    }
  })

  it('starts a due break when not idle', () => {
    idleTime = 0
    breaksPlanner.nextBreak()
    vi.advanceTimersByTime(interval)
    emitted.should.deep.equal(['startMicrobreak'])
  })

  it('holds a due break while idle beyond the threshold', () => {
    idleTime = 120000
    breaksPlanner.nextBreak()
    vi.advanceTimersByTime(interval * 3)
    emitted.should.not.include('startMicrobreak')
    breaksPlanner.scheduler.reference.should.equal('holdBreak')
  })

  it('holds the notification of a due break while idle beyond the threshold', () => {
    settings.set({ microbreakNotification: true, microbreakNotificationInterval: 500 })
    idleTime = 120000
    breaksPlanner.nextBreak()
    vi.advanceTimersByTime(interval)
    emitted.should.not.include('startMicrobreakNotification')
  })

  it('postpones a held break once active again, without using up a postpone', () => {
    idleTime = 120000
    breaksPlanner.nextBreak()
    vi.advanceTimersByTime(interval)
    idleTime = 0
    vi.advanceTimersByTime(settings.get('naturalBreaksCheckInterval'))
    breaksPlanner.scheduler.reference.should.equal('startMicrobreak')
    breaksPlanner.postponesNumber.should.equal(0)
    emitted.should.not.include('startMicrobreak')
    vi.advanceTimersByTime(settings.get('microbreakPostponeTime'))
    emitted.should.include('startMicrobreak')
  })

  it('pauses breaks while a video is playing', async () => {
    isVideoPlaying = true
    breaksPlanner.nextBreak()
    await vi.advanceTimersByTimeAsync(interval * 3)
    emitted.should.not.include('startMicrobreak')
    breaksPlanner.isPausedForVideo.should.equal(true)
  })

  it('starts the break timer fresh once the video stops', async () => {
    breaksPlanner.nextBreak()
    await vi.advanceTimersByTimeAsync(interval * 0.8)
    isVideoPlaying = true
    await vi.advanceTimersByTimeAsync(videoCheckInterval)
    isVideoPlaying = false
    await vi.advanceTimersByTimeAsync(videoCheckInterval)
    await vi.advanceTimersByTimeAsync(interval * 0.5)
    emitted.should.not.include('startMicrobreak')
    await vi.advanceTimersByTimeAsync(interval * 0.5)
    emitted.should.include('startMicrobreak')
  })

  it('keeps breaks paused when the user is active again during a video', async () => {
    isVideoPlaying = true
    breaksPlanner.nextBreak()
    await vi.advanceTimersByTimeAsync(videoCheckInterval)
    breaksPlanner.naturalBreaksManager.emit('naturalBreakFinished')
    breaksPlanner.isPausedForVideo.should.equal(true)
  })

  afterEach(async () => {
    breaksPlanner.pause(1)
    breaksPlanner = null
    Object.defineProperty(process, 'platform', platform)
    vi.restoreAllMocks()
    vi.useRealTimers()
    await rm(join(__dirname, '/test-settings-breaksPlanner.json'), { force: true })
    settings = null
  })
})
