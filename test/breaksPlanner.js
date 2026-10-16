import { vi } from 'vitest'
import 'chai/register-should'
import { join } from 'path'
import BreaksPlanner from '../app/breaksPlanner'
import NaturalBreaksManager from '../app/utils/naturalBreaksManager'
import Store from 'electron-store'
import defaultSettings from '../app/utils/defaultSettings'
import { rm } from 'node:fs/promises'

describe('breaksPlanner idle threshold', function () {
  const interval = 1000
  let settings = null
  let breaksPlanner = null
  let idleTime = 0
  let emitted = []

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(NaturalBreaksManager.prototype, 'idleTime', 'get').mockImplementation(() => idleTime)
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
      breakIdleThreshold: 60000
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

  it('skips a due break and plans the next one when idle beyond the threshold', () => {
    idleTime = 120000
    breaksPlanner.nextBreak()
    vi.advanceTimersByTime(interval)
    emitted.should.deep.equal(['updateToolTip'])
    breaksPlanner.scheduler.reference.should.equal('startBreak')
  })

  it('skips the notification of a due break when idle beyond the threshold', () => {
    settings.set({ microbreakNotification: true, microbreakNotificationInterval: 500 })
    idleTime = 120000
    breaksPlanner.nextBreak()
    vi.advanceTimersByTime(interval)
    emitted.should.not.include('startMicrobreakNotification')
  })

  it('counts a skipped Long break as taken', () => {
    idleTime = 120000
    breaksPlanner.nextBreak()
    vi.advanceTimersByTime(interval)
    breaksPlanner.scheduler.reference.should.equal('startBreak')
    vi.advanceTimersByTime(interval)
    breaksPlanner.scheduler.reference.should.equal('startMicrobreak')
  })

  afterEach(async () => {
    breaksPlanner.pause(1)
    breaksPlanner = null
    vi.restoreAllMocks()
    vi.useRealTimers()
    await rm(join(__dirname, '/test-settings-breaksPlanner.json'), { force: true })
    settings = null
  })
})
