import { vi } from 'vitest'
import 'chai/register-should'
import { join } from 'path'
import NaturalBreaksManager from '../app/utils/naturalBreaksManager'
import Store from 'electron-store'
import defaultSettings from '../app/utils/defaultSettings'
import { rm } from 'node:fs/promises'

describe('naturalBreaksManager', function () {
  let settings = null
  let naturalBreaksManager = null

  beforeEach(() => {
    settings = new Store({
      cwd: join(__dirname),
      name: 'test-settings-naturalBreaksManager',
      defaults: defaultSettings
    })
    naturalBreaksManager = new NaturalBreaksManager(settings)
  })

  it('should be running with default settings', () => {
    naturalBreaksManager.isOnNaturalBreak.should.be.equal(false)
    naturalBreaksManager.isSchedulerCleared.should.be.equal(false)
    naturalBreaksManager.usingNaturalBreaks.should.be.equal(true)
  })

  it('should not be running with naturalBreaks: false', () => {
    settings.set('naturalBreaks', false)
    naturalBreaksManager.stop()
    naturalBreaksManager = null
    naturalBreaksManager = new NaturalBreaksManager(settings)
    naturalBreaksManager.isOnNaturalBreak.should.be.equal(false)
    naturalBreaksManager.isSchedulerCleared.should.be.equal(false)
    naturalBreaksManager.usingNaturalBreaks.should.be.equal(false)
  })

  it('should be running with naturalBreaks: true', () => {
    settings.set('naturalBreaks', true)
    naturalBreaksManager.stop()
    naturalBreaksManager = null
    naturalBreaksManager = new NaturalBreaksManager(settings)
    naturalBreaksManager.isOnNaturalBreak.should.be.equal(false)
    naturalBreaksManager.isSchedulerCleared.should.be.equal(false)
    naturalBreaksManager.usingNaturalBreaks.should.be.equal(true)
  })

  it('should start when start()', () => {
    naturalBreaksManager.stop()
    naturalBreaksManager.start()
    naturalBreaksManager.isOnNaturalBreak.should.be.equal(false)
    naturalBreaksManager.isSchedulerCleared.should.be.equal(false)
    naturalBreaksManager.usingNaturalBreaks.should.be.equal(true)
  })

  it('should stop when stop()', () => {
    naturalBreaksManager.stop()
    naturalBreaksManager.usingNaturalBreaks.should.be.equal(false)
    naturalBreaksManager.isSchedulerCleared.should.be.equal(false)
    naturalBreaksManager.isOnNaturalBreak.should.be.equal(false)
    naturalBreaksManager.idleTime.should.be.equal(0)
  })

  it('does not create a second timer when start() is called twice', () => {
    naturalBreaksManager.stop()
    naturalBreaksManager.start()
    const timer = naturalBreaksManager.timer
    naturalBreaksManager.start()
    naturalBreaksManager.timer.should.be.equal(timer)
  })

  it('is idle beyond the break threshold only when the threshold is reached', () => {
    vi.spyOn(naturalBreaksManager, 'idleTime', 'get').mockReturnValue(60000)
    settings.set('breakIdleThreshold', 60000)
    naturalBreaksManager.isIdleBeyondBreakThreshold.should.be.equal(true)
    settings.set('breakIdleThreshold', 65000)
    naturalBreaksManager.isIdleBeyondBreakThreshold.should.be.equal(false)
  })

  it('is never idle beyond the break threshold when it is 0', () => {
    vi.spyOn(naturalBreaksManager, 'idleTime', 'get').mockReturnValue(600000)
    settings.set('breakIdleThreshold', 0)
    naturalBreaksManager.isIdleBeyondBreakThreshold.should.be.equal(false)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    naturalBreaksManager.stop()
    naturalBreaksManager = null

    if (settings) {
      await rm(join(__dirname, '/test-settings-naturalBreaksManager.json'), { force: true })
      settings = null
    }
  })
})
