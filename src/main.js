import './style.scss';



document.addEventListener('DOMContentLoaded', () => {

  document.body.style.opacity = '';

  const gradientBackground_1 = gradientBackground('.background-canvas-1', {
    topBgColor: { r: 0, g: 0, b: 0 },
    bottomBgColor: { r: 0, g: 0, b: 0 },
    circle1: { color: { r: 36, g: 36, b: 36 }, visible: true, posX: 0.2, posY: 0.3, radiusFactor: 1.0, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circle2: { color: { r: 24, g: 24, b: 24 }, visible: true, posX: 0.8, posY: 0.7, radiusFactor: 1.0, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circle3: { color: { r: 12, g: 12, b: 12 }, visible: true, posX: 0.5, posY: 0.1, radiusFactor: 1.0, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circle4: { color: { r: 64, g: 64, b: 64 }, visible: true, posX: 0.0, posY: 0.97, radiusFactor: 2.0, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circle5: { color: { r: 24, g: 24, b: 24 }, visible: true, posX: 0.9, posY: 0.2, radiusFactor: 1.0, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circleInteractive: { color: { r: 248, g: 248, b: 248 }, visible: false, posX: 0.5, posY: 0.5, radiusFactor: 1.0, positionEnabled: true },
    intensityExponent: 1.4,
    movementSpeedMultiplier: 3, 
    interactiveFollowFactor: 0.1,
    noiseAmount: 0.04,
    noiseSpeed: 0.1,
    responsive: {
      'max-width: 767px': {
        circle4: { radiusFactor: 4.0 },
        movementSpeedMultiplier: 2, 
      }
    }
  });

  gradientBackground_1.play();

  const buttons = document.querySelectorAll('button');

  buttons.forEach(v => {
    
    v.addEventListener('click', v => {

      if (v.currentTarget.classList.contains('play')){
        gradientBackground_1.play();
      } else if (v.currentTarget.classList.contains('pause')) {
        gradientBackground_1.pause();
      } else if (v.currentTarget.classList.contains('reset')) {
        gradientBackground_1.reset();
      }
    })
  })
})

const gradientBackground = (selector = '.background-canvas', options = {}) => {

  const gui = new lil.GUI(); // LIL GUI初期化
  const canvas = document.querySelector(selector);

  if (!canvas) {
    console.error(`Canvas element not found with selector: ${selector}`);
    return;
  }

  // 初期状態は停止(paused)としてクラスを設定
  canvas.classList.add('is-initialized', 'is-paused');
  canvas.classList.remove('is-playing');

  const gl = canvas.getContext('webgl');

  if (!gl) {
    console.error("WebGL not supported");
    return;
  }

  // アニメーション制御用の変数
  let animationFrameId = null;
  let isRunning = false;
  let startTime = null;
  let animationTime = 0;

  // canvasのサイズを取得
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  const getBaseRadius = (w, h) => (w + h) * 0.2;
  const getInteractiveRadius = (w, h) => (w + h) * 0.1;

  // 補助関数: シンプルなディープマージ（ここでは2階層まで対応）
  function deepMerge(target, source) {

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && !(source[key] instanceof Float32Array)) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {

          // target[key]がオブジェクトでない場合、または配列の場合は新しいオブジェクトで初期化
          target[key] = {};
        }
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  // 補助関数: ディープコピー
  function deepCopy(obj) {

    if (obj === null || typeof obj !== 'object') {
          return obj;
      }
      if (Array.isArray(obj)) {
          return obj.map(item => deepCopy(item));
      }

      const copy = {};

      for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
              copy[key] = deepCopy(obj[key]);
          }
      }
      return copy;
  }

  function resizeCanvas() {

    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    gl.viewport(0, 0, width, height);

    const baseRadius = getBaseRadius(width, height);
    const interactiveRadius = getInteractiveRadius(width, height);

    circles.forEach((c) => {
      
      // 正規化された位置を現在のサイズに再スケーリング
      c.x = c.normalizedX * width;
      c.y = c.normalizedY * height;
      
      // 半径も現在のサイズに合わせて再計算
      // 注意: c.baseRadiusはGUIのradiusFactorとは別に、画面サイズ依存の初期半径を保持している。
      // c.baseRadiusはinteractiveに応じて再計算されるべき。
      c.baseRadius = (c.interactive ? interactiveRadius : baseRadius);
    });

    // レスポンシブ設定の適用
    applyResponsiveSettings();
  }
  window.addEventListener('resize', resizeCanvas);

  let mouse = { x: width / 2, y: height / 2 };

  const onMouseMove = (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  window.addEventListener('mousemove', onMouseMove);

  const defaultGuiColors = {// GUIで調整するデータ構造 (初期値)
    topBgColor: { r: 255, g: 255, b: 255 },
    bottomBgColor: { r: 222, g: 222, b: 222 },
    circle1: { color: { r: 255, g: 255, b: 255 }, visible: false, posX: 0.2, posY: 0.3, radiusFactor: 1.0, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circle2: { color: { r: 255, g: 255, b: 255 }, visible: true, posX: 0.8, posY: 0.7, radiusFactor: 1.0, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circle3: { color: { r: 255, g: 155, b: 0 }, visible: true, posX: 0.5, posY: 0.1, radiusFactor: 1.0, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circle4: { color: { r: 255, g: 155, b: 0 }, visible: true, posX: 0.0, posY: 0.97, radiusFactor: 1.8, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circle5: { color: { r: 255, g: 155, b: 0 }, visible: true, posX: 0.9, posY: 0.2, radiusFactor: 1.0, vxFactor: 1.0, vyFactor: 1.0, positionEnabled: false },
    circleInteractive: { color: { r: 248, g: 248, b: 248 }, visible: false, posX: 0.5, posY: 0.5, radiusFactor: 1.0, positionEnabled: true },
    intensityExponent: 1.4,
    movementSpeedMultiplier: 3,
    interactiveFollowFactor: 0.1,
    noiseAmount: 0,
    noiseSpeed: 0,
    responsive: {}
  };

  // 引数のoptionsで初期値を上書きする
  // この時点の guiColors は「デフォルト値 + optionsによる上書き」が適用された初期設定となる
  const guiColors = { ...defaultGuiColors };

  // マージ対象キーを定義
  const circleConfigKeys = ['topBgColor', 'bottomBgColor', 'circle1', 'circle2', 'circle3', 'circle4', 'circle5', 'circleInteractive'];
  const deepMergeKeys = [...circleConfigKeys, 'responsive'];

  // トップレベルのプリミティブなプロパティをマージ
  Object.keys(options).forEach(key => {

    // オブジェクトでないプロパティは直接上書き
    if (guiColors[key] !== undefined && typeof guiColors[key] !== 'object') {
      guiColors[key] = options[key];
    }
  });

  // サークル設定と responsive のディープマージ
  deepMergeKeys.forEach(key => {

    if (options[key] && typeof options[key] === 'object') {
      // 既存のオブジェクトとオプションのオブジェクトをディープマージ
      deepMerge(guiColors[key], options[key]);
    }
  });

  // 初期設定を保存: レスポンシブでない場合の基準となる値 (deepCopyを使用)
  const initialGuiColors = deepCopy(guiColors);

  // レスポンシブ設定を適用する関数
  function applyResponsiveSettings() {
    
    const responsiveSettings = initialGuiColors.responsive;

    // guiColors を初期設定 (initialGuiColors) に戻す
    // （responsiveプロパティ自体は更新不要なので、それ以外をコピー）
    for (const key in initialGuiColors) {
      if (key !== 'responsive' && Object.prototype.hasOwnProperty.call(initialGuiColors, key)) {
        if (typeof initialGuiColors[key] === 'object' && initialGuiColors[key] !== null) {
          deepMerge(guiColors[key], initialGuiColors[key]); // deepMergeで初期値に戻す
        } else {
          guiColors[key] = initialGuiColors[key]; // プリミティブな値は直接上書き
        }
      }
    }


    // 現在マッチしているレスポンシブ設定をチェックし、上書きする
    let currentResponsiveProps = {};

    for (const query in responsiveSettings) {
      if (window.matchMedia(`(${query})`).matches) {
        
        // マッチした場合、その設定を現在の設定にディープマージ
        deepMerge(currentResponsiveProps, responsiveSettings[query]);
      }
    }

    // 上書きされる値だけを guiColors オブジェクトに適用
    for (const key in currentResponsiveProps) {
      if (Object.prototype.hasOwnProperty.call(guiColors, key)) {
        if (guiColors[key] && typeof guiColors[key] === 'object' && !Array.isArray(guiColors[key])) {
          
          // オブジェクトのディープマージ（例: topBgColor）
          deepMerge(guiColors[key], currentResponsiveProps[key]);
        } else {
          
          // プリミティブな値の直接上書き（例: intensityExponent）
          guiColors[key] = currentResponsiveProps[key];
        }
      }
    }

    // GUIコントローラに値を反映
    gui.controllers.forEach(controller => {
        controller.updateDisplay();
    });
    gui.folders.forEach(folder => {
        folder.controllers.forEach(controller => {
            controller.updateDisplay();
        });
    });

    // レンダリングを1度実行して反映
    if (!isRunning) {
        render(performance.now());
    }
  }

  function rgbObjToNormalizedArray(rgbObj) {
    return [rgbObj.r / 255.0, rgbObj.g / 255.0, rgbObj.b / 255.0];
  }

  let circles = [];
  let initialCirclesState = [];

  function initCircles() {

    circles = [];
    initialCirclesState = [];

    const baseRadius = getBaseRadius(width, height);
    const interactiveRadius = getInteractiveRadius(width, height);
    const guiCircleKeys = ['circle1', 'circle2', 'circle3', 'circle4', 'circle5', 'circleInteractive'];

    for (let i = 0; i < 6; i++) {

      const circleKey = guiCircleKeys[i];
      
      // circleDataは initialGuiColors から取得するように変更
      // guiColors はレスポンシブで変更される可能性があるため、初期位置の計算には initialGuiColors を使うのが安全。
      const circleData = initialGuiColors[circleKey]; 
      const isInteractive = circleKey === 'circleInteractive';
      const x = circleData.posX * width;
      const y = circleData.posY * height;
      const baseR = isInteractive ? interactiveRadius : baseRadius;
      const baseVx = isInteractive ? 0 : (Math.random() - 0.5) * (Math.random() * 4 + 1);
      const baseVy = isInteractive ? 0 : (Math.random() - 0.5) * (Math.random() * 4 + 1);
      const newCircle = {
        x,
        y,
        baseRadius: baseR,
        colorIndex: i + 1,
        vx: baseVx,
        vy: baseVy,
        interactive: isInteractive,
        normalizedX: circleData.posX,
        normalizedY: circleData.posY,
      };

      circles.push(newCircle);
      initialCirclesState.push({ ...newCircle });
    }
  }

  initCircles();

  // シェーダーコード
  const vertexSrc = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main(void) {
      v_uv = a_position * 0.5 + 0.5;
      v_uv.y = 1.0 - v_uv.y;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSrc = `
    precision mediump float;
    varying vec2 v_uv;

    uniform vec2 u_resolution;
    uniform bool u_darkMode;
    uniform int u_circleCount;
    uniform vec3 u_circlesColor[6];
    uniform vec3 u_circlesPosRad[6];
    uniform vec2 u_mouse;
    uniform vec3 u_topBgColor;
    uniform vec3 u_bottomBgColor;
    uniform float u_intensityExponent;
    
    uniform float u_time;
    uniform float u_noiseAmount;

    float rand(vec2 st, float t) {
      return fract(sin(dot(st, vec2(12.9898, 78.233)) + t) * 43758.5453);
    }

    void main(void) {

      vec2 st = v_uv * u_resolution;

      vec3 bgColor = mix(u_topBgColor, u_bottomBgColor, st.y / u_resolution.y);

      float fieldSum = 0.0;
      vec3 weightedColorSum = vec3(0.0);
      
      for (int i = 0; i < 6; i++) {
          if (i >= u_circleCount) { break; }
          vec3 posRad = u_circlesPosRad[i];
          vec2 cPos = vec2(posRad.r, posRad.g);
          float radius = posRad.b;
          float dist = length(st - cPos);
          float sigma = radius * 0.5;
          float val = exp(- (dist * dist) / (2.0 * sigma * sigma));
          fieldSum += val;
          weightedColorSum += u_circlesColor[i] * val;
      }

      vec3 finalCirclesColor = vec3(0.0);
      if (fieldSum > 0.0) {
        finalCirclesColor = weightedColorSum / fieldSum;
      }

      float intensity = pow(fieldSum, u_intensityExponent);
      vec3 baseColor = mix(bgColor, finalCirclesColor, clamp(intensity, 0.0, 1.0));
      
      float noiseVal = rand(floor(st), u_time * 100.0);
      noiseVal = (noiseVal - 0.5) * 2.0;
      vec3 finalColor = baseColor + noiseVal * u_noiseAmount;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  function createShader(type, source) {
    
    const shader = gl.createShader(type);
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertShader = createShader(gl.VERTEX_SHADER, vertexSrc);
  const fragShader = createShader(gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();

  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
  }

  gl.useProgram(program);

  const quadBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);

  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const a_position = gl.getAttribLocation(program, "a_position");

  gl.enableVertexAttribArray(a_position);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

  const u_resolution = gl.getUniformLocation(program, "u_resolution");
  const u_darkMode = gl.getUniformLocation(program, "u_darkMode");
  const u_circleCount = gl.getUniformLocation(program, "u_circleCount");
  const u_circlesColor = gl.getUniformLocation(program, "u_circlesColor[0]");
  const u_circlesPosRad = gl.getUniformLocation(program, "u_circlesPosRad[0]");
  const u_mouse = gl.getUniformLocation(program, "u_mouse");
  const u_topBgColor = gl.getUniformLocation(program, "u_topBgColor");
  const u_bottomBgColor = gl.getUniformLocation(program, "u_bottomBgColor");
  const u_intensityExponent = gl.getUniformLocation(program, "u_intensityExponent");
  const u_time = gl.getUniformLocation(program, "u_time");
  const u_noiseAmount = gl.getUniformLocation(program, "u_noiseAmount");

  gl.uniform2f(u_resolution, width, height);

  const guiCircleKeys = ['circle1', 'circle2', 'circle3', 'circle4', 'circle5', 'circleInteractive'];

  function updateCircles() {

    const speedMultiplier = guiColors.movementSpeedMultiplier;
    const followFactor = guiColors.interactiveFollowFactor;

    for (let i = 0; i < circles.length; i++) {

      const c = circles[i];
      const circleData = guiColors[guiCircleKeys[i]];

      if (circleData.positionEnabled && (c.normalizedX !== circleData.posX || c.normalizedY !== circleData.posY)) {
        c.x = circleData.posX * width;
        c.y = circleData.posY * height;
        c.normalizedX = circleData.posX;
        c.normalizedY = circleData.posY;
      }

      if (!c.interactive) {

        const currentVx = c.vx * speedMultiplier * circleData.vxFactor;
        const currentVy = c.vy * speedMultiplier * circleData.vyFactor;

        c.x += currentVx;
        c.y += currentVy;

        const currentRadius = c.baseRadius * circleData.radiusFactor;

        if (c.x - currentRadius > width) c.x = -currentRadius;
        if (c.x + currentRadius < 0) c.x = width + currentRadius;
        if (c.y - currentRadius > height) c.y = -currentRadius;
        if (c.y + currentRadius < 0) c.y = height + currentRadius;

        c.normalizedX = c.x / width;
        c.normalizedY = c.y / height;

      } else {
        c.x += (mouse.x - c.x) * followFactor;
        c.y += (mouse.y - c.y) * followFactor;
      }
    }
  }

  // GUIコントローラーの設定
  const movementFolder = gui.addFolder('Movement Controls');

  movementFolder.add(guiColors, 'movementSpeedMultiplier', 0.0, 5.0).name('Global Speed');
  movementFolder.add(guiColors, 'interactiveFollowFactor', 0.01, 0.5).name('Follow Factor').step(0.01);
  movementFolder.open();

  const bgFolder = gui.addFolder('Background Color');

  bgFolder.addColor(guiColors, 'topBgColor').name('Top Color');
  bgFolder.addColor(guiColors, 'bottomBgColor').name('Bottom Color');
  bgFolder.open();

  const circleFolder = gui.addFolder('Circle Controls');

  function addCircleControls(circleKey, name) {
    const cFolder = circleFolder.addFolder(name);
    cFolder.add(guiColors[circleKey], 'visible').name('Visible');
    cFolder.addColor(guiColors[circleKey], 'color').name('Color');
    cFolder.add(guiColors[circleKey], 'positionEnabled').name('Position Control');
    cFolder.add(guiColors[circleKey], 'posX', 0.0, 1.0).name('Position X').step(0.01);
    cFolder.add(guiColors[circleKey], 'posY', 0.0, 1.0).name('Position Y').step(0.01);
    cFolder.add(guiColors[circleKey], 'radiusFactor', 0.1, 5.0).name('Radius Factor').step(0.1);
    if (circleKey !== 'circleInteractive') {
      cFolder.add(guiColors[circleKey], 'vxFactor', 0.0, 5.0).name('Velocity X Factor').step(0.1);
      cFolder.add(guiColors[circleKey], 'vyFactor', 0.0, 5.0).name('Velocity Y Factor').step(0.1);
    }
    cFolder.close();
  }
  addCircleControls('circle1', 'Circle 1');
  addCircleControls('circle2', 'Circle 2');
  addCircleControls('circle3', 'Circle 3');
  addCircleControls('circle4', 'Circle 4');
  addCircleControls('circle5', 'Circle 5');
  addCircleControls('circleInteractive', 'Interactive Circle');
  gui.add(guiColors, 'intensityExponent', 0.1, 5.0).name('Intensity Power');
  
  const noiseFolder = gui.addFolder("Noise Setting");
  
  noiseFolder.add(guiColors, 'noiseAmount', 0.0, 0.2).name('ノイズ量');
  noiseFolder.add(guiColors, 'noiseSpeed', 0.0, 1.0).name('ノイズ速度');

  // render関数
  function render(timestamp) {

    if (!startTime) {
      startTime = timestamp;
      animationTime = 0;
    } else {
      animationTime = timestamp - startTime;
    }

    updateCircles();

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(u_resolution, width, height);
    gl.uniform2f(u_mouse, mouse.x, mouse.y);

    const top = rgbObjToNormalizedArray(guiColors.topBgColor);
    const bottom = rgbObjToNormalizedArray(guiColors.bottomBgColor);

    gl.uniform3f(u_topBgColor, top[0], top[1], top[2]);
    gl.uniform3f(u_bottomBgColor, bottom[0], bottom[1], bottom[2]);
    gl.uniform1f(u_intensityExponent, guiColors.intensityExponent);

    gl.uniform1f(u_time, animationTime / 1000 * guiColors.noiseSpeed);
    gl.uniform1f(u_noiseAmount, guiColors.noiseAmount);

    let colorsArr = [];
    let posRadArr = [];
    let visibleCircleCount = 0;

    for (let i = 0; i < circles.length; i++) {

      const circleKey = guiCircleKeys[i];
      const circleData = guiColors[circleKey];
      const c = circles[i];

      if (circleData.visible) {
        const color = rgbObjToNormalizedArray(circleData.color);
        colorsArr.push(color[0], color[1], color[2]);

        const finalRadius = c.baseRadius * circleData.radiusFactor;

        posRadArr.push(c.x, c.y, finalRadius);

        visibleCircleCount++;
      }
    }

    gl.uniform1i(u_circleCount, visibleCircleCount);

    const maxCircles = 6;

    for (let i = visibleCircleCount; i < maxCircles; i++) {
      colorsArr.push(0, 0, 0);
      posRadArr.push(0, 0, 0);
    }

    gl.uniform3fv(u_circlesColor, new Float32Array(colorsArr));
    gl.uniform3fv(u_circlesPosRad, new Float32Array(posRadArr));

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // アニメーション実行フラグがtrueの場合のみ、次のフレームを要求
    if (isRunning) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  // アニメーションを再生
  const play = () => {
    
    if (!isRunning) {
      isRunning = true;

      // 再開時の時間を設定
      startTime = performance.now() - animationTime;
      animationFrameId = requestAnimationFrame(render);
      
      // クラス追加 (再生)
      canvas.classList.add('is-playing');
      canvas.classList.remove('is-paused');
    }
  };

  // アニメーションを停止
  const pause = () => {

    if (isRunning) {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      
      // クラス追加 (停止)
      canvas.classList.remove('is-playing');
      canvas.classList.add('is-paused');
    }
  };

  // アニメーションを初期状態に戻し、停止
  const reset = () => {

    // 停止
    pause();

    // サークルの位置を初期状態に戻す
    circles.forEach((c, i) => {
      const initialState = initialCirclesState[i];
      c.x = initialState.x;
      c.y = initialState.y;
      c.normalizedX = initialState.normalizedX;
      c.normalizedY = initialState.normalizedY;

      if (c.interactive) {
        mouse.x = c.x;
        mouse.y = c.y;
      }
      
      // 速度も初期のランダム値に戻す
      c.vx = initialState.vx;
      c.vy = initialState.vy;
    });

    // アニメーション経過時間もリセット
    animationTime = 0;
    startTime = null;

    // リセット後の静止画を一度描画
    render(0);

    // クラス設定 (リセット後は停止状態)
    canvas.classList.remove('is-playing');
    canvas.classList.add('is-paused');
  };

  // 初期呼び出し
  // レスポンシブ設定を適用
  applyResponsiveSettings();
  // リセットして初期状態で停止
  reset();

  // 外部アクセスできるようにメソッドを返却
  return {
    play,
    pause,
    reset,
    canvas,
    gl,
    gui
  };
};
