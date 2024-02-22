/**
 * Copyright (c) 2019-present, Sony Interactive Entertainment Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from 'events'
import TypedEmitter from 'typed-emitter'
import { Peripheral, Characteristic } from 'noble-mac'
import {
  Event,
  IdCharacteristic,
  MotorCharacteristic,
  LightCharacteristic,
  LightOperation,
  SoundCharacteristic,
  SoundOperation,
  SensorCharacteristic,
  ButtonCharacteristic,
  BatteryCharacteristic,
  ConfigurationCharacteristic,
} from './characteristics'
import { MoveToTarget, MoveToOptions, MotorSpec } from './characteristics/specs/motor-spec'

function missingCharacteristicRejection(): Promise<never> {
  return Promise.reject('cannot discover the characteristic')
}

export class Cube {
  /**
   * UUID of cube BLE service
   */
  public static readonly TOIO_SERVICE_ID = '10b201005b3b45719508cf3efcd7bbae'

  private readonly eventEmitter: EventEmitter = new EventEmitter()

  private readonly peripheral: Peripheral

  private motorCharacteristic: MotorCharacteristic | null = null
  private lightCharacteristic: LightCharacteristic | null = null
  private soundCharacteristic: SoundCharacteristic | null = null
  private sensorCharacteristic: SensorCharacteristic | null = null
  private buttonCharacteristic: ButtonCharacteristic | null = null
  private batteryCharacteristic: BatteryCharacteristic | null = null
  private configurationCharacteristic: ConfigurationCharacteristic | null = null

  /**
   * Create a new cube instance
   *
   * @param peripheral - a noble's peripheral object
   */
  public constructor(peripheral: Peripheral) {
    this.peripheral = peripheral
  }

  /**
   * id of cube as a BLE Peripheral
   */
  public get id(): string {
    return this.peripheral.id
  }

  /**
   * address of cube as a BLE Peripheral
   */
  public get address(): string {
    return this.peripheral.address
  }

  /**
   * Connect to the cube
   *
   * @returns Promise object
   */
  public connect(): Promise<Cube> {
    return new Promise((resolve, reject) => {
      this.peripheral.connect(error => {
        if (error) {
          reject(error)
          return
        }

        this.peripheral.discoverAllServicesAndCharacteristics(async (error2, _service, characteristics) => {
          if (error2) {
            reject(error2)
            return
          }

          if (characteristics) {
            this.setCharacteristics(characteristics)
          }

          const bleProtocolVersion = await this.getBLEProtocolVersion()
          this.initCharacteristics(bleProtocolVersion)

          resolve(this)
        })
      })
    })
  }

  public disconnect(): Promise<void> {
    return new Promise(resolve => {
      this.peripheral.disconnect(() => {
        resolve()
      })
    })
  }

  public on<E extends keyof Event>(event: E, listener: Event[E]): this {
    const typedEmitter = this.eventEmitter as TypedEmitter<Event>
    typedEmitter.on(event, listener)
    return this
  }

  public off<E extends keyof Event>(event: E, listener: Event[E]): this {
    const typedEmitter = this.eventEmitter as TypedEmitter<Event>
    typedEmitter.removeListener(event, listener)
    return this
  }

  //
  // ID Detection
  //

  //
  // Motor Control
  //

  /**
   * Move cube
   *
   * @param left - [-115, 115] speed of left motor
   * @param right - [-115, 115] speed of right motor
   * @param duration - [0, 2550] duration in millisecond. 0 means endless.
   * @returns Promise object
   */
  public move(left: number, right: number, duration = 0): Promise<void> | void {
    return this.motorCharacteristic !== null
      ? this.motorCharacteristic.move(left, right, duration)
      : missingCharacteristicRejection()
  }

  /**
   * Move cube to the specific coordinate and angle
   *
   * @param targets - list of target
   * @param options - option argument
   * @returns Promise object
   */
  public moveTo(
    targets: MoveToTarget[],
    options: MoveToOptions = { moveType: 0, maxSpeed: 115, speedType: 0, timeout: 0, overwrite: true },
  ): Promise<void> {
    return this.motorCharacteristic !== null
      ? this.motorCharacteristic.moveTo(targets, options)
      : missingCharacteristicRejection()
  }

  /**
   * Move cube to the specific coordinate and angle
   *
   * @param translationSpeed - [-115, 115] translational speed
   * @param rotationSpeed - [-32767, 32767] rotational speed / unit : degree per second
   * @param acceleration - [0, 255] moving acceleration. 0 means speed up immediately.
   * @param priorityType - [0, 1] translation and rotation speed priorities
   * @param durationMs - [0, 2550] duration in millisecond. 0 means endless.
   * @returns Promise object
   */
  public accelerationMove(
    translationSpeed: number,
    rotationSpeed: number,
    acceleration = 0,
    priorityType = MotorSpec.ACC_PRIORITY_STRAIGHT,
    durationMs = 0,
  ): Promise<void> | void {
    return this.motorCharacteristic !== null
      ? this.motorCharacteristic.accelerationMove(
          translationSpeed,
          rotationSpeed,
          acceleration,
          priorityType,
          durationMs,
        )
      : missingCharacteristicRejection()
  }

  /**
   * Stop cube movement
   */
  public stop(): void {
    if (this.motorCharacteristic !== null) {
      this.motorCharacteristic.stop()
    }
  }

  //
  // LED
  //

  /**
   * Turn on a light
   *
   * @param operation - LED information (duration and color)
   * @returns Promise object
   */
  public turnOnLight(operation: LightOperation): Promise<void> | void {
    return this.lightCharacteristic !== null
      ? this.lightCharacteristic.turnOnLight(operation)
      : missingCharacteristicRejection()
  }

  /**
   * Turn on a light
   *
   * @param operations - list of LED information (duration and color)
   * @param repeatCount - the number of repeat, 0 means eternal loop.
   * @returns Promise object
   */
  public turnOnLightWithScenario(operations: LightOperation[], repeatCount = 0): Promise<void> | void {
    return this.lightCharacteristic !== null
      ? this.lightCharacteristic.turnOnLightWithScenario(operations, repeatCount)
      : missingCharacteristicRejection()
  }

  /**
   * Turn off a light
   */
  public turnOffLight(): void {
    if (this.lightCharacteristic !== null) {
      this.lightCharacteristic.turnOffLight()
    }
  }

  //
  // Sound
  //

  /**
   * Play preset sound
   *
   * @param soundId - [0, 10] id of preset sound
   */
  public playPresetSound(soundId: number): void {
    if (this.soundCharacteristic !== null) {
      this.soundCharacteristic.playPresetSound(soundId)
    }
  }

  /**
   * Play sound
   *
   * @param operations - list of buzzer information (duration and note name)
   * @param repeatCount - the number of repeat, 0 means eternal loop.
   * @returns Promise object
   */
  public playSound(operations: SoundOperation[], repeatCount = 0): Promise<void> | void {
    return this.soundCharacteristic !== null
      ? this.soundCharacteristic.playSound(operations, repeatCount)
      : missingCharacteristicRejection()
  }

  /**
   * Stop sound
   */
  public stopSound(): void {
    if (this.soundCharacteristic !== null) {
      this.soundCharacteristic.stopSound()
    }
  }

  //
  // Sensor
  //

  /**
   * Get slope status
   *
   * @returns Promise object
   */
  public getSlopeStatus(): Promise<{ isSloped: boolean }> {
    return this.sensorCharacteristic !== null
      ? this.sensorCharacteristic.getSlopeStatus()
      : missingCharacteristicRejection()
  }

  /**
   * Get collision status
   *
   * @returns Promise object
   */
  public getCollisionStatus(): Promise<{ isCollisionDetected: boolean }> {
    return this.sensorCharacteristic !== null
      ? this.sensorCharacteristic.getCollisionStatus()
      : missingCharacteristicRejection()
  }

  public getDoubleTapStatus(): Promise<{ isDoubleTapped: boolean }> {
    return this.sensorCharacteristic !== null
      ? this.sensorCharacteristic.getDoubleTapStatus()
      : missingCharacteristicRejection()
  }

  public getShakeStatus(): Promise<{ shakeLevel: number }> {
    return this.sensorCharacteristic !== null
      ? this.sensorCharacteristic.getShakeLevel()
      : missingCharacteristicRejection()
  }

  public getOrientation(): Promise<{ orientation: number }> {
    return this.sensorCharacteristic !== null
      ? this.sensorCharacteristic.getOrientation()
      : missingCharacteristicRejection()
  }

  public getMagnetId(): Promise<{ id: number }> {
    return this.sensorCharacteristic !== null
      ? this.sensorCharacteristic.getMagnetId()
      : missingCharacteristicRejection()
  }

  public getMagnetForce(): Promise<{ force: number; directionX: number; directionY: number; directionZ: number }> {
    return this.sensorCharacteristic !== null
      ? this.sensorCharacteristic.getMagnetForce()
      : missingCharacteristicRejection()
  }

  public getAttitudeEuler(): Promise<{ roll: number; pitch: number; yaw: number }> {
    return this.sensorCharacteristic !== null
      ? this.sensorCharacteristic.getAttitudeEuler()
      : missingCharacteristicRejection()
  }

  public getAttitudeQuaternion(): Promise<{ w: number; x: number; y: number; z: number }> {
    return this.sensorCharacteristic !== null
      ? this.sensorCharacteristic.getAttitudeQuaternion()
      : missingCharacteristicRejection()
  }

  //
  // Button
  //

  /**
   * Read button status
   *
   * @returns Promise object
   */
  public getButtonStatus(): Promise<{ pressed: boolean }> {
    return this.buttonCharacteristic !== null
      ? this.buttonCharacteristic.getButtonStatus()
      : missingCharacteristicRejection()
  }

  //
  // Battery
  //

  /**
   * Get battery status
   *
   * @returns Promise object
   */
  public getBatteryStatus(): Promise<{ level: number }> {
    return this.batteryCharacteristic !== null
      ? this.batteryCharacteristic.getBatteryStatus()
      : missingCharacteristicRejection()
  }

  //
  // Configuration
  //

  public getBLEProtocolVersion(): Promise<string> {
    return this.configurationCharacteristic !== null
      ? this.configurationCharacteristic.getBLEProtocolVersion()
      : missingCharacteristicRejection()
  }

  public setFlatThreshold(degree: number): void {
    if (this.configurationCharacteristic !== null) {
      this.configurationCharacteristic.setFlatThreshold(degree)
    }
  }

  public setCollisionThreshold(threshold: number): void {
    if (this.configurationCharacteristic !== null) {
      this.configurationCharacteristic.setCollisionThreshold(threshold)
    }
  }

  public setIdNotification(intervalMs: number, notificationType: number): void {
    if (this.configurationCharacteristic !== null) {
      this.configurationCharacteristic.setIdNotification(intervalMs, notificationType)
    }
  }

  public setIdMissedNotification(sensitivityMs: number): void {
    if (this.configurationCharacteristic !== null) {
      this.configurationCharacteristic.setIdMissedNotification(sensitivityMs)
    }
  }

  public setDoubleTapIntervalThreshold(threshold: number): void {
    if (this.configurationCharacteristic !== null) {
      this.configurationCharacteristic.setDoubleTapIntervalThreshold(threshold)
    }
  }

  public setMotorSpeedFeedback(enable: boolean): void {
    if (this.configurationCharacteristic !== null) {
      this.configurationCharacteristic.setMotorSpeedFeedback(enable)
    }
  }

  public setMagnetDetection(detectType: number, intervalMs: number, notificationType = 0): void {
    if (this.configurationCharacteristic !== null) {
      this.sensorCharacteristic?.setMagnetMode(detectType)
      this.configurationCharacteristic.setMagnetDetection(detectType, intervalMs, notificationType)
    }
  }

  public setAttitudeControl(format: number, intervalMs: number, notificationType: number): void {
    if (this.configurationCharacteristic !== null) {
      this.configurationCharacteristic.setAttitudeControl(format, intervalMs, notificationType)
    }
  }

  private setCharacteristics(characteristics: Characteristic[]): void {
    characteristics.forEach(characteristic => {
      switch (characteristic.uuid) {
        case IdCharacteristic.UUID:
          new IdCharacteristic(characteristic, this.eventEmitter)
          break
        case MotorCharacteristic.UUID:
          this.motorCharacteristic = new MotorCharacteristic(characteristic, this.eventEmitter)
          break
        case LightCharacteristic.UUID:
          this.lightCharacteristic = new LightCharacteristic(characteristic)
          break
        case SoundCharacteristic.UUID:
          this.soundCharacteristic = new SoundCharacteristic(characteristic)
          break
        case SensorCharacteristic.UUID:
          this.sensorCharacteristic = new SensorCharacteristic(characteristic, this.eventEmitter)
          break
        case ButtonCharacteristic.UUID:
          this.buttonCharacteristic = new ButtonCharacteristic(characteristic, this.eventEmitter)
          break
        case BatteryCharacteristic.UUID:
          this.batteryCharacteristic = new BatteryCharacteristic(characteristic, this.eventEmitter)
          break
        case ConfigurationCharacteristic.UUID:
          this.configurationCharacteristic = new ConfigurationCharacteristic(characteristic)
          break
        default:
        // TODO: log
      }
    })
  }

  private initCharacteristics(bleProtocolVersion: string): void {
    if (this.motorCharacteristic !== null) {
      this.motorCharacteristic.init(bleProtocolVersion)
    }
    if (this.configurationCharacteristic !== null) {
      this.configurationCharacteristic.init(bleProtocolVersion)
    }
    if (this.sensorCharacteristic !== null) {
      this.sensorCharacteristic.notifyMotionStatus()
      this.sensorCharacteristic.notifyMagnetStatus()
    }
  }
}
