// =====================================================================
//  《星月夜》— 致敬文森特·梵高（1889）
// =====================================================================

// ---------------------------------------------------------------------
//  手势识别引擎
// ---------------------------------------------------------------------
const MP_VERSION = "0.10.21";
const MP_URLS = [
  `https://registry.npmmirror.com/@mediapipe/tasks-vision/${MP_VERSION}/files`,
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`,
];
const MODEL_URLS = [
  "gesture_recognizer.task",
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
];

const GESTURE_NAMES = {
  None: "无",
  Closed_Fist: "握拳 ✊",
  Open_Palm: "张开手掌 🖐",
  Pointing_Up: "食指向上 ☝️",
  Thumb_Down: "拇指向下 👎",
  Thumb_Up: "拇指向上 👍",
  Victory: "剪刀手 ✌️",
  ILoveYou: "我爱你 🤟",
};

let video;
let recognizer = null;
let hands = [];
let lastVideoTime = -1;
let started = false;
let showCamera = false;

async function loadGestureRecognizer() {
  setStatus("正在加载手势模型…");
  for (const base of MP_URLS) {
    let vision, fileset;
    try {
      vision = await import(`${base}/vision_bundle.mjs`);
      fileset = await vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
    } catch (e) {
      continue;
    }
    for (const model of MODEL_URLS) {
      for (const delegate of ["GPU", "CPU"]) {
        try {
          recognizer = await vision.GestureRecognizer.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: model, delegate },
            runningMode: "VIDEO",
            numHands: 2,
          });
          return;
        } catch (e) {}
      }
    }
  }
  setStatus("⚠️ 手势模型加载失败：请把 gesture_recognizer.task 放进项目文件夹");
}

let cameraOk = null;
function updateHands() {
  if (!recognizer || !video) return;

  const ok = video.elt.readyState >= 2;
  if (ok !== cameraOk) {
    cameraOk = ok;
    setStatus(ok ? "把手伸到摄像头前，做一个手势 ✋"
                 : "正在等待摄像头…请点击「允许」，然后刷新页面");
  }
  if (!ok) return;

  if (video.elt.currentTime === lastVideoTime) return;
  lastVideoTime = video.elt.currentTime;

  const result = recognizer.recognizeForVideo(video.elt, performance.now());
  const sides = result.handedness || result.handednesses || [];
  hands = result.landmarks.map((lm, i) => {
    const best = (result.gestures[i] && result.gestures[i][0]) || { categoryName: "None", score: 0 };
    return {
      gesture: best.categoryName || "None",
      score: best.score,
      side: sides[i] && sides[i][0] ? sides[i][0].categoryName : "",
      points: lm.map((p) => ({ x: (1 - p.x) * width, y: p.y * height, z: p.z })),
    };
  });
}

function drawGestureInfo() {
  push();
  textSize(16);
  textAlign(CENTER, TOP);
  for (const hand of hands) {
    const w = hand.points[0];
    const y = min(w.y + 14, height - 70);
    const label = `${GESTURE_NAMES[hand.gesture] || hand.gesture}  ${round(hand.score * 100)}%`;
    noStroke();
    fill(0, 120);
    rect(w.x - textWidth(label) / 2 - 8, y, textWidth(label) + 16, 26, 6);
    fill(255);
    text(label, w.x, y + 4);
  }
  pop();
}

function drawCamera() {
  push();
  translate(width, 0);
  scale(-1, 1);
  tint(255, 70);
  image(video, 0, 0, width, height);
  pop();
}

function setStatus(msg) {
  select("#status").html(msg);
}


// ---------------------------------------------------------------------
//  作品：《星月夜》
// ---------------------------------------------------------------------

const SKY_DEEP = "#14215e";
const MAX_STARS = 12;
const STAR_NOTES = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98];

let paint;
let particles = [];
let stars = [];
let moon = null;
let lastGesture = {};
let wind = 0;
let showInfo = true;

let chime, chimeEnv;
let windNoise, windFilter;

function setup() {
  createCanvas(windowWidth, windowHeight);
  paint = createGraphics(windowWidth, windowHeight);
  resetSky();
  for (let i = 0; i < 120; i++) particles.push(newParticle());
  select("#start").mouseClicked(startExperience);
}

function resetSky() {
  paint.background(SKY_DEEP);
  stars = [
    { x: width * 0.25, y: height * 0.22, r: 18, phase: 0 },
    { x: width * 0.55, y: height * 0.35, r: 40, phase: 1 },
    { x: width * 0.72, y: height * 0.15, r: 16, phase: 2 },
  ];
  moon = { x: width * 0.86, y: height * 0.16 };
}

function newParticle() {
  return { x: random(width), y: random(height * 0.8), life: random(20, 60) };
}

function startExperience() {
  userStartAudio();

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  chime = new p5.Oscillator("sine");
  chime.amp(0);
  chime.start();
  chimeEnv = new p5.Envelope();
  chimeEnv.setADSR(0.003, 1.2, 0, 0.2);
  chimeEnv.setRange(0.3, 0);

  windFilter = new p5.LowPass();
  windNoise = new p5.Noise("pink");
  windNoise.disconnect();
  windNoise.connect(windFilter);
  windNoise.amp(0);
  windNoise.start();

  select("#intro").hide();
  started = true;
  loadGestureRecognizer();
}

function draw() {
  let palmOpen = false;
  if (started) {
    updateHands();
    for (const hand of hands) {
      const g = hand.score >= 0.6 ? hand.gesture : "None";
      if (g === "Open_Palm") palmOpen = true;
      if (g === "None") continue;
      if (g !== lastGesture[hand.side]) onGesture(g, hand);
      lastGesture[hand.side] = g;
    }
    if (hands.length === 0) lastGesture = {};
  }
  wind = lerp(wind, palmOpen ? 1 : 0, 0.05);
  if (windNoise) {
    windNoise.amp(wind * 0.4, 0.1);
    windFilter.freq(300 + wind * 1200);
  }

  for (let step = 0; step < 2; step++) {
    for (const p of particles) {
      const a = flowAngle(p.x, p.y);
      const speed = 2.5 + wind * 5;
      p.x += cos(a) * speed;
      p.y += sin(a) * speed;
      p.life--;
      if (p.life <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height * 0.85) {
        Object.assign(p, newParticle());
        continue;
      }
      drawBrushStroke(paint, p.x, p.y, a, skyColor(p.x, p.y));
    }
  }

  image(paint, 0, 0);
  if (started && showCamera) drawCamera();
  drawVillage();
  if (moon) drawMoon(moon);
  for (const s of stars) drawStar(s);

  if (started) {
    for (const hand of hands) {
      noStroke();
      fill(255, 230, 120, 200);
      circle(hand.points[8].x, hand.points[8].y, 10);
    }
    if (showInfo) drawGestureInfo();
  }
}

function drawBrushStroke(g, x, y, angle, col) {
  g.stroke(col);
  g.strokeWeight(2.5);
  const len = 5 + random(4);
  const jitter = random(-0.25, 0.25);
  const nx = x + cos(angle + jitter) * len;
  const ny = y + sin(angle + jitter) * len;
  g.line(x, y, nx, ny);
}

function skyColor(x, y) {
  const t = constrain(y / (height * 0.85), 0, 1);
  const r = lerp(18, 70, t);
  const g = lerp(28, 110, t);
  const b = lerp(90, 150, t);
  return color(r + random(-6, 6), g + random(-6, 6), b + random(-6, 6));
}

function flowAngle(x, y) {
  const scale = 0.0015;
  const n = noise(x * scale, y * scale, frameCount * 0.0008);
  return n * TWO_PI * 2.5;
}

function drawStar(s) {
  push();
  noStroke();
  const twinkle = sin(frameCount * 0.04 + s.phase * 10) * 0.25 + 0.75;
  for (let i = 3; i >= 1; i--) {
    fill(255, 215, 90, 25 * twinkle);
    circle(s.x, s.y, s.r * i * 1.4);
  }
  fill(255, 245, 190, 255 * twinkle);
  circle(s.x, s.y, s.r * 0.9);
  pop();
}

function onGesture(g, hand) {
  if (g === "Pointing_Up") {
    const tip = hand.points[8];
    if (stars.length < MAX_STARS) {
      stars.push({ x: tip.x, y: tip.y, r: 12, phase: random(TWO_PI) });
      playStarNote(stars.length);
    }
  } else if (g === "Thumb_Up") {
    const tip = hand.points[4];
    if (stars.length < MAX_STARS) {
      stars.push({ x: tip.x, y: tip.y, r: 30, phase: random(TWO_PI) });
      playStarNote(stars.length + 3);
    }
  } else if (g === "Closed_Fist") {
    moon = { x: hand.points[9].x, y: hand.points[9].y };
  } else if (g === "Victory") {
    resetSky();
  }
}

function drawVillage() {
  const base = height * 0.85;
  noStroke();
  fill(18, 28, 60);
  beginShape();
  vertex(0, height);
  for (let x = 0; x <= width; x += 40) vertex(x, base - 40 + 25 * sin(x * 0.01));
  vertex(width, height);
  endShape(CLOSE);
  for (let i = 0; i < 9; i++) {
    const x = width * (0.35 + i * 0.06);
    const h = 26 + (i % 3) * 10;
    fill(30, 38, 70);
    rect(x, base - h + 10, 34, h);
    fill(240, 200, 80);
    rect(x + 8, base - h + 18, 7, 7);
    rect(x + 20, base - h + 18, 7, 7);
  }
  fill(30, 38, 70);
  triangle(width * 0.62, base - 120, width * 0.6, base - 30, width * 0.64, base - 30);
  fill(12, 30, 20);
  beginShape();
  vertex(width * 0.08, height);
  bezierVertex(width * 0.02, height * 0.6, width * 0.14, height * 0.45, width * 0.12, height * 0.12);
  bezierVertex(width * 0.18, height * 0.45, width * 0.24, height * 0.6, width * 0.2, height);
  endShape(CLOSE);
}

function drawMoon(m) {
  noStroke();
  for (let i = 4; i >= 1; i--) {
    fill(255, 220, 90, 35);
    circle(m.x, m.y, 50 * i * 0.9);
  }
  fill(250, 215, 80);
  circle(m.x, m.y, 50);
  fill(20, 33, 94);
  circle(m.x + 14, m.y - 8, 40);
}

function playStarNote(n) {
  if (!chime) return;
  chime.freq(midiToFreq(STAR_NOTES[constrain(n, 0, STAR_NOTES.length - 1)]));
  chimeEnv.play(chime);
}

function keyPressed() {
  if (key === "c" || key === "C") resetSky();
  if (key === "s" || key === "S") saveCanvas("my-starry-night", "png");
  if (key === "v" || key === "V") showCamera = !showCamera;
  if (key === "i" || key === "I") showInfo = !showInfo;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  paint = createGraphics(windowWidth, windowHeight);
  resetSky();
}
