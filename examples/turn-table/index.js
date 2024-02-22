// index.js

require('dotenv').config({ path: __dirname+'/./.env' })

const { NearScanner } = require('@toio/scanner')
const mqtt = require("mqtt");

class MqttCtrl {
  constructor(url = process.env.MQTT_URL) {
    this.callback = [];
    this.client = mqtt.connect(url);
    this.url = url;
    this.topics = [];

    this.client.on("connect", () => {
      console.log("mqtt connected.")
    });

    this.client.on("message", async (topic, message) => {
      // - message is Buffer
      const messageA = message.toString()
      console.log("messageA", messageA)
      for (const callback of this.callback) {
        callback(topic, messageA);
      }
    });
  }

  addMsgCallback(callback) {
    this.callback.push(callback)
  }

  subscribe(topic) {
    this.topics.push(topic);
    this.client.subscribe(topic, (err) => {
      if (!err) {
        this.client.publish(topic, "start to subscribe.");
      } else {
        console.log("fail to subscribe.", e); 
      }
    });
  }

  publish(topic, msg) {
    topic = topic ? topic : this.topic;
    this.client.publish(topic, msg);
  }
}

const toioBaseWheelSpeed = { l: 50, r: 40 };
const toioACenter = { x: 330, y: 250 };
const toioBCenter = { x: 160, y: 250 };
const toidAColor = { red: 0, green: 0, blue: 255 };
const toidBColor = { red: 255, green: 0, blue: 0 };
const toioRadius = 10;

class ToioCtrl {
  constructor(cube, name,
    center = { x: 330, y: 250 },
    baseWheelSpeed = { l: 50, r: 40 },
    color = { red: 0, green: 0, blue: 255 },
    radius = 10) {
    this.cube = cube;
    this.name = name;
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
    this.mqttCtrl = null;

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

    this.#publishCubeStartMsg();
  }

  stop() {
    this.isRun = false;
    if (this.circulateTimerId) {
      clearInterval(this.circulateTimerId);
      this.circulateTimerId = null;
    }
    this.cube.stop();

    this.#publishCubeStopMsg();
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

  setMqttCtrl(mqttCtrl) {
    this.mqttCtrl = mqttCtrl;
    this.mqttCtrl.addMsgCallback(this.#msgHandler.bind(this))
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
    // const state = await this.cube.getDoubleTapStatus();
    // if (state.isDoubleTapped) {
      // console.log("state.isDoubleTapped");
     //  this.#publishEfxMsg();
    //}
    const state = await this.cube.getShakeStatus();
      if (state.shakeLevel > 0) {
        console.log("shake");
        this.#publishEfxMsg();
      }
  }

  async #circulate() {
    // https://toio.io/do/make/td1m0164/ を参照した。
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

  async #msgHandler(topic, message) {
    console.log(topic, message);
    try {
      const payload = JSON.parse(message);
      console.log(payload)
      if (payload) {
        if (payload.to === "cube") {
          if (payload.cmd === "cubeDirection") {
            if (payload.prm) {
              if (payload.prm.cube == this.name) {
                this.stop();
                this.isReverse = payload.prm.reverse ? true : false;
                this.start();
              }
            }
          }
        }
      }
    } catch (e) {
      console.log("cannot parse payload");
    }
  }

  #publishMqtt(payload) {
    if (this.mqttCtrl) {
      this.mqttCtrl.publish(process.env.MQTT_TOPIC, JSON.stringify({
        ...payload,
        to: "turntable",
        from: "cube"
      }));
    }
  }

  #publishCubeStartMsg() {
    this.#publishMqtt({
      cmd: "cubeStart",
      prm: {
        cube: this.name
      }
    });
  }

  #publishCubeStopMsg() {
    this.#publishMqtt({
      cmd: "cubeStop",
      prm: {
        cube: this.name
      }
    });
  }

  #publishEfxMsg() {
    this.#publishMqtt({
      cmd: "efx",
    });
  }
}

async function main() {
  const mqtt = new MqttCtrl(process.env.MQTT_URL);
  mqtt.subscribe(process.env.MQTT_TOPIC);

  // start a scanner to find nearest two cubes
  const cubes = await new NearScanner(2).start()

  // connect two cubes
  const cubeA = await cubes[0].connect()
  const cubeB = await cubes[1].connect()

  const ToioCtrlA = new ToioCtrl(
    cubeA, 0, toioACenter, toioBaseWheelSpeed, toidAColor, toioRadius);
  ToioCtrlA.lightOn();

  const ToioCtrlB = new ToioCtrl(
    cubeB, 1, toioBCenter, toioBaseWheelSpeed, toidBColor, toioRadius);
  ToioCtrlB.lightOn();
  
  ToioCtrlA.setMqttCtrl(mqtt);
  ToioCtrlB.setMqttCtrl(mqtt);
}

main()
