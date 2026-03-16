// 无常 — 弦（星座+拖尾版）

const VIDEO_W = 640;
const VIDEO_H = 480;

function mapX(x) { return map(x, 0, VIDEO_W, 0, width);  }
function mapY(y) { return map(y, 0, VIDEO_H, 0, height); }

const NUM_STRINGS = 12;
const FADE_MS     = 25000;
const PINCH_PX    = 35;
const SEGMENTS    = 50;
const STIFFNESS   = 0.2;
const DAMPING     = 0.65;

const BASE_FREQS = [
  73.4, 87.3, 110.0, 130.8, 146.8,
  174.6, 220.0, 261.6, 293.7, 349.2,
  440.0, 523.3
];

// 星座连线（手部骨骼）
const BONES = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

// 每个关节点的星星大小（指尖稍大，掌根最大）
const STAR_SIZE = [
  8, 5, 5, 5, 7,    // 掌根, 拇指
  5, 4, 4, 7,       // 食指
  5, 4, 4, 6,       // 中指
  5, 4, 4, 6,       // 无名指
  5, 4, 4, 6        // 小指
];

let handPose, video;
let hands = [];
let strings = [];
let traces  = [];

let grabbedIdx  = null;
let grabbedT    = 0;
let isPinching  = false;
let isLoaded    = false;

// 拖尾历史：每个关键点保存最近 N 帧的位置
const TRAIL_LEN = 18;
let trailHistory = []; // trailHistory[pointIdx] = [{x,y,t}, ...]

let audioStarted = false;
let osc, ampEnv;

// ─── setup ───────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO);
  video.size(VIDEO_W, VIDEO_H);
  video.hide();

  handPose = ml5.handpose(video, { flipHorizontal: true }, () => {
    console.log('HandPose ready');
    isLoaded = true;
  });
  handPose.on('predict', r => { hands = r; });

  // 初始化拖尾历史
  for (let i = 0; i < 21; i++) trailHistory[i] = [];

  buildStrings();
}

function buildStrings() {
  strings = [];
  let mx = width * 0.08;
  for (let i = 0; i < NUM_STRINGS; i++) {
    let y = map(i, 0, NUM_STRINGS - 1, height * 0.1, height * 0.9);
    strings.push(new StringLine(mx, y, width - mx, y, BASE_FREQS[i]));
  }
}

function initAudio() {
  if (audioStarted) return;
  userStartAudio();
  osc = [
    new p5.Oscillator('triangle'),
    new p5.Oscillator('triangle'),
    new p5.Oscillator('sine'),
  ];
  ampEnv = new p5.Envelope();
  ampEnv.setADSR(0.005, 0.1, 0.0, 0.0);
  ampEnv.setRange(0.35, 0);
  for (let o of osc) { o.amp(0); o.start(); }
  audioStarted = true;
}

function pluckSound(stringIdx, displacement) {
  if (!audioStarted) return;
  let base = BASE_FREQS[stringIdx];
  let pitchShift = map(abs(displacement), 0, height * 0.4, 1.0, 1.08);
  let freq = base * pitchShift;
  osc[0].freq(freq);
  osc[1].freq(freq * 2.01);
  osc[2].freq(freq * 3.0);
  let vel = map(abs(displacement), 10, 150, 0.15, 0.55, true);
  let releaseTime = map(stringIdx, 0, NUM_STRINGS - 1, 2.8, 1.2);
  ampEnv.setRange(vel, 0);
  ampEnv.setADSR(0.004, 0.08, 0.0, releaseTime);
  ampEnv.play(osc[0]);
  osc[1].amp(vel * 0.3, 0.005); osc[1].amp(0, releaseTime * 0.6);
  osc[2].amp(vel * 0.1, 0.005); osc[2].amp(0, releaseTime * 0.4);
}

function dragSound(stringIdx, displacement) {
  if (!audioStarted) return;
  let base = BASE_FREQS[stringIdx];
  let pitchShift = map(abs(displacement), 0, height * 0.4, 1.0, 1.08);
  osc[0].freq(base * pitchShift, 0.08);
}

// ─── draw ────────────────────────────────────────────────
function draw() {
  background(0);

  if (!isLoaded) {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(48);
    text("Loading, please wait...", width/2, height/2);
    return;
  }

  // 极淡摄像头剪影
  push();
  tint(255, 12);
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  let pinchPos = null;

  if (hands && hands.length > 0) {
    let hand = hands[0];
    let lm   = hand.landmarks;

    if (lm && lm.length >= 21) {
      // 更新拖尾历史
      let now = millis();
      for (let i = 0; i < 21; i++) {
        trailHistory[i].push({ x: mapX(lm[i][0]), y: mapY(lm[i][1]), t: now });
        // 只保留最近的帧
        if (trailHistory[i].length > TRAIL_LEN) trailHistory[i].shift();
      }

      let tx = mapX(lm[4][0]), ty = mapY(lm[4][1]);
      let ix = mapX(lm[8][0]), iy = mapY(lm[8][1]);
      let d  = dist(tx, ty, ix, iy);
      let mx = (tx + ix) / 2;
      let my = (ty + iy) / 2;
      pinchPos = createVector(mx, my);

      let nowPinching = d < PINCH_PX;

      if (nowPinching && !isPinching) {
        initAudio();
        let best = null, bestDist = Infinity;
        for (let i = 0; i < strings.length; i++) {
          let r = strings[i].closestPoint(mx, my);
          if (r.dist < bestDist && r.dist < 80) {
            bestDist = r.dist; best = i; grabbedT = r.t;
          }
        }
        grabbedIdx = best;
      }

      if (!nowPinching && isPinching) {
        if (grabbedIdx !== null) {
          pluckSound(grabbedIdx, strings[grabbedIdx].dragAmt);
          strings[grabbedIdx].release();
        }
        grabbedIdx = null;
      }

      isPinching = nowPinching;
      if (isPinching && grabbedIdx !== null) {
        strings[grabbedIdx].drag(grabbedT, mx, my);
        dragSound(grabbedIdx, strings[grabbedIdx].dragAmt);
      }

      // 绘制星座手
      drawConstellationHand(lm, nowPinching);
    }
  } else {
    // 手消失：清空拖尾
    for (let i = 0; i < 21; i++) trailHistory[i] = [];
    if (isPinching && grabbedIdx !== null) {
      pluckSound(grabbedIdx, strings[grabbedIdx].dragAmt);
      strings[grabbedIdx].release();
    }
    isPinching = false; grabbedIdx = null;
  }

  // 痕迹
  let now = millis();
  traces = traces.filter(t => now - t.born < FADE_MS);
  for (let t of traces) t.draw(now);

  // 弦
  for (let i = 0; i < strings.length; i++) {
    strings[i].update(i === grabbedIdx, grabbedT, pinchPos, traces, now);
    strings[i].draw(i === grabbedIdx);
  }

  // 捏合光晕
  if (pinchPos && isPinching) {
    noFill();
    stroke(200, 230, 255, 100);
    strokeWeight(0.8);
    ellipse(pinchPos.x, pinchPos.y, 22, 22);
  }

  // 状态
  fill(50, 80, 100);
  noStroke();
  textSize(15);
  textAlign(CENTER);
  textStyle(ITALIC);
  if (!audioStarted) {
    text('Press your fingers together to begin', width/2, height - 24);
  } else if (!hands || hands.length === 0) {
    text('Reach out', width/2, height - 24);
  } else if (!isPinching) {
    text('Pinch the string between your thumb and index finger and pull it', width/2, height - 24);
  } else if (grabbedIdx !== null) {
    text('Playing the string', width/2, height - 24);
  } else {
    text('Move closer to a string and pinch it', width/2, height - 24);
  //       text('捏合手指以开始', width/2, height - 24);
  // } else if (!hands || hands.length === 0) {
  //   text('伸出手', width/2, height - 24);
  // } else if (!isPinching) {
  //   text('拇指与食指捏合，拉动弦', width/2, height - 24);
  // } else if (grabbedIdx !== null) {
  //   text('拉动中', width/2, height - 24);
  // } else {
  //   text('靠近一根弦再捏合', width/2, height - 24);
  }
}

// ─── 星座 + 拖尾 ──────────────────────────────────────────
function drawConstellationHand(lm, pinching) {
  let now = millis();
  let TRAIL_DURATION = 320; // 拖尾存活毫秒

  // 1. 拖尾（先画，在星点之下）
  // 只给指尖和掌根画拖尾，其余关节不画，避免过于混乱
  const TRAIL_POINTS = [0, 4, 8, 12, 16, 20];
  for (let pi of TRAIL_POINTS) {
    let hist = trailHistory[pi];
    if (hist.length < 2) continue;
    noFill();
    for (let j = 1; j < hist.length; j++) {
      let p0 = hist[j - 1];
      let p1 = hist[j];
      // 按时间计算透明度：越旧越淡
      let age = now - p0.t;
      let alpha = map(age, 0, TRAIL_DURATION, 140, 0, true);
      let w     = map(j, 0, hist.length, 1.2, 5.5);
      stroke(160, 200, 255, alpha);
      strokeWeight(w);
      line(p0.x, p0.y, p1.x, p1.y);
    }
  }

  // 2. 星座连线
  for (let [a, b] of BONES) {
    if (!lm[a] || !lm[b]) continue;
    let ax = mapX(lm[a][0]), ay = mapY(lm[a][1]);
    let bx = mapX(lm[b][0]), by = mapY(lm[b][1]);
    strokeWeight(4);
    stroke(100, 160, 255, pinching ? 28 : 18);
    line(ax, ay, bx, by);
    strokeWeight(1.6);
    stroke(170, 210, 255, pinching ? 210 : 165);
    line(ax, ay, bx, by);
  }

  // 3. 星点
  noStroke();
  for (let i = 0; i < lm.length; i++) {
    if (!lm[i]) continue;
    let x = mapX(lm[i][0]);
    let y = mapY(lm[i][1]);
    let r = STAR_SIZE[i] || 2;

    // 拇指尖(4)和食指尖(8)捏合时发光
    let isActive = (i === 4 || i === 8) && pinching;
    let isFingerTip = (i === 4 || i === 8 || i === 12 || i === 16 || i === 20);

    if (isActive) {
      fill(180, 220, 255, 25);
      ellipse(x, y, r * 5, r * 5);
      fill(210, 235, 255, 60);
      ellipse(x, y, r * 2.5, r * 2.5);
      fill(245, 252, 255, 240);
      ellipse(x, y, r, r);
    } else if (isFingerTip) {
      fill(140, 185, 255, 30);
      ellipse(x, y, r * 3.5, r * 3.5);
      fill(190, 220, 255, 200);
      ellipse(x, y, r, r);
    } else {
      fill(150, 185, 240, 180);
      ellipse(x, y, r, r);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildStrings();
}

// ════════════════════════════════════════════════════════
// StringLine
// ════════════════════════════════════════════════════════
class StringLine {
  constructor(x1, y1, x2, y2, freq) {
    this.x1 = x1; this.y1 = y1;
    this.x2 = x2; this.y2 = y2;
    this.freq = freq;
    this.n = SEGMENTS;
    this.offsets = new Array(this.n).fill(0);
    this.vels    = new Array(this.n).fill(0);
    this.dragIdx = null;
    this.dragAmt = 0;
  }
  getX(i)    { return lerp(this.x1, this.x2, i / (this.n - 1)); }
  getRestY(i){ return lerp(this.y1, this.y2, i / (this.n - 1)); }
  closestPoint(mx, my) {
    let bestD = Infinity, bestT = 0;
    for (let i = 0; i < this.n; i++) {
      let d = dist(mx, my, this.getX(i), this.getRestY(i) + this.offsets[i]);
      if (d < bestD) { bestD = d; bestT = i / (this.n - 1); }
    }
    return { dist: bestD, t: bestT };
  }
  drag(t, mx, my) {
    this.dragIdx = round(t * (this.n - 1));
    this.dragAmt = my - this.getRestY(this.dragIdx);
  }
  release() { this.dragIdx = null; this.dragAmt = 0; }
  update(grabbed, grabbedT, pinchPos, traces, now) {
    if (grabbed && this.dragIdx !== null) {
      this.offsets[this.dragIdx] = this.dragAmt;
      this.vels[this.dragIdx] = 0;
      if (abs(this.dragAmt) > 10 && frameCount % 3 === 0) {
        traces.push(new Trace(
          this.getX(this.dragIdx),
          this.getRestY(this.dragIdx) + this.offsets[this.dragIdx],
          abs(this.dragAmt), now
        ));
      }
    }
    for (let i = 1; i < this.n - 1; i++) {
      if (grabbed && i === this.dragIdx) continue;
      let f = (this.offsets[i-1] + this.offsets[i+1]) * 0.5 - this.offsets[i];
      this.vels[i] += f * STIFFNESS;
      this.vels[i] *= DAMPING;
    }
    this.offsets[0] = this.offsets[this.n-1] = 0;
    this.vels[0]    = this.vels[this.n-1]    = 0;
    for (let i = 1; i < this.n - 1; i++) {
      if (grabbed && i === this.dragIdx) continue;
      this.offsets[i] += this.vels[i];
    }
  }
  draw(grabbed) {
    let maxD = 0;
    for (let o of this.offsets) if (abs(o) > maxD) maxD = abs(o);
    let alpha  = map(maxD, 0, 80, grabbed ? 200 : 140, 255, true);
    let bright = map(maxD, 0, 100, grabbed ? 210 : 160, 255, true);
    noFill();
    stroke(bright * 0.75, bright * 0.88, bright, alpha);
    strokeWeight(grabbed ? 1.2 : 0.8);
    beginShape();
    for (let i = 0; i < this.n; i++)
      vertex(this.getX(i), this.getRestY(i) + this.offsets[i]);
    endShape();
    if (maxD > 20) {
      stroke(230, 245, 255, map(maxD, 20, 100, 0, 60, true));
      strokeWeight(0.4);
      beginShape();
      for (let i = 0; i < this.n; i++)
        vertex(this.getX(i), this.getRestY(i) + this.offsets[i]);
      endShape();
    }
  }
}

// ════════════════════════════════════════════════════════
// Trace
// ════════════════════════════════════════════════════════
class Trace {
  constructor(x, y, intensity, born) {
    this.x = x; this.y = y;
    this.intensity = constrain(intensity, 0, 150);
    this.born = born;
    this.r = 1.5 + intensity * 0.045;
  }
  draw(now) {
    let life  = 1 - (now - this.born) / FADE_MS;
    let eased = (life > 0.3 ? 1.0 : life / 0.3) * life;
    let a = map(this.intensity, 0, 150, 55, 160) * eased;
    if (a < 1) return;
    let rr = map(this.intensity, 0, 150, 185, 225);
    let gg = map(this.intensity, 0, 150, 205, 240);
    noStroke();
    fill(rr, gg, 255, a * 0.12);
    ellipse(this.x, this.y, this.r * map(life, 0, 1, 1, 4));
    fill(rr, gg, 255, a * 0.28);
    ellipse(this.x, this.y, this.r * 1.5);
    fill(rr, gg, 255, a);
    ellipse(this.x, this.y, this.r * 0.7);
  }
}