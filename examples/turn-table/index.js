// index.js
const { NearScanner } = require('@toio/scanner')

const toioBaseWheelSpeed = { l: 50, r: 40 };
const toioACenter = { x: 330, y: 250 };
const toioBCenter = { x: 160, y: 250 };
const toidAColor = { red: 0, green: 0, blue: 255 };
const toidBColor = { red: 255, green: 0, blue: 0 };
const toioRadius = 10;

class ToioCtrl {
  constructor(cube, 
    center = { x: 330, y: 250 },
    baseWheelSpeed = { l: 50, r: 40 },
    color = { red: 0, green: 0, blue: 255 },
    radius = 10) {
    this.cube = cube;
    this.color = color;
    this.isRun = false;
    this.circulateTimerId = null;
    this.baseWheelSpeed = baseWheelSpeed;
    this.center = center;
    this.radius = radius;
    this.speed = 1.0;
    this.isReverse = false;
    this.currRadius = 0;
    this.prevRadiuses = [0, 0];


    this.cube.on('id:position-id', (data) => {
      this.#onPositionId(data.x, data.y);
    });
    this.cube.on('id:position-id-missed', () => {
      console.log("id:position-id-missed");
      this.#onPositionIdMissed();
    });

    // - 1秒毎に shake state を 検出
    setInterval(async () => {
      this.#checkShake();
    }, 1000)
  }

  start() {
    this.isRun = true;
    
    // - fail safe
    if (this.circulateTimerId) {
      clearInterval(this.circulateTimerId);
    }

    this.circulateTimerId = setInterval(async () => {
      this.#circulate();
      this.prevRadiuses[1] = this.prevRadiuses[0];
      this.prevRadiuses[0] = this.currRadius;
    }, 100);
    // publishStart(1)
  }

  stop() {
    this.isRun = false;
    if (this.circulateTimerId) {
      clearInterval(this.circulateTimerId);
      this.circulateTimerId = null;
    }
    this.cube.stop();
    // publishStop(1);
  }

  setLightColor(color) {
    this.color = color;
  }

  lightOn() {
    this.cube.turnOnLight({ durationMs: 0, ...this.color })
  }

  lightOff() {
    this.cube.turnOffLight()
  }

  #onPositionId(x, y) {
    if (!this.isRun) {
      this.start()
    }
    this.currRadius = this.#calcDist(x, y, this.center.x, this.center.y);
  }

  #onPositionIdMissed() {
    if (this.isRun) {
      this.stop()
    }
  }

  async #checkShake() {
    // - なぜか、getDoubleTapStatus で shake 状態が検出される。toio.js のバグか？
    const state = await this.cube.getDoubleTapStatus();
    if (state.isDoubleTapped) {
      console.log("state.isDoubleTapped");
      // client.publish(topic, JSON.stringify({cmd: "efx"}));
    }
  }

  async #circulate() {
    const ki = 0.1
    const kd = 1.0
    const kp = 0
    const delta = (kp * (this.currRadius - this.radius)) + 
      (ki * ((this.currRadius - this.radius) + ((this.prevRadiuses[0] - this.radius) + (this.prevRadiuses[1] - this.radius)))) +
      (kd * ((this.currRadius - this.radius) - (this.prevRadiuses[0] - this.radius)));
    
    const reverseCoef = this.isReverse ? -1.0 : 1.0;
    this.cube.move(reverseCoef * this.baseWheelSpeed.l * this.speed + reverseCoef * delta, 
      reverseCoef * this.baseWheelSpeed.r * this.speed - reverseCoef * delta, 0)
  }

  // - 座標間の距離を求める。
  #calcDist(x0, y0, x1, y1) {
    return Math.sqrt(Math.pow(Math.abs(x0 - x1), 2) + Math.pow(Math.abs(y0 - y1), 2));
  }

}

async function main() {
  // start a scanner to find nearest two cubes
  const cubes = await new NearScanner(2).start()

  // connect two cubes
  const cubeA = await cubes[0].connect()
  const cubeB = await cubes[1].connect()

  const ToioCtrlA = new ToioCtrl(
    cubeA, toioACenter, toioBaseWheelSpeed, toidAColor, toioRadius);
  ToioCtrlA.lightOn()

  const ToioCtrlB = new ToioCtrl(
    cubeB, toioBCenter, toioBaseWheelSpeed, toidBColor, toioRadius);
  ToioCtrlB.lightOn()
}

main()
