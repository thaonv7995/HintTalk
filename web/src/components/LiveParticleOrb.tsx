import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const LIVE_PARTICLE_DOT_COUNT = 560;
const PARTICLE_SHAPE_MORPH_MS = 3200;
const PARTICLE_SHAPE_HOLD_MS = 5200;

type Particle3 = { x: number; y: number; z: number };
type LiveParticleOrbStatus = 'idle' | 'live' | 'listening' | 'ai_speaking' | 'connecting' | 'cooldown' | 'error';

const PARTICLE_SHAPE_SEQUENCE = [
  'sphere',
  'ellipsoid',
  'cube',
  'octahedron',
  'cylinder',
  'torus',
  'waveRing',
  'capsule',
  'doubleCone',
  'spiralRibbon',
] as const;

type ParticleShapeKind = (typeof PARTICLE_SHAPE_SEQUENCE)[number];

const fract01 = (x: number) => x - Math.floor(x);

function fibonacciSpherePoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0;
    const rho = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = ga * i;
    pts.push({ x: Math.cos(theta) * rho, y, z: Math.sin(theta) * rho });
  }
  return pts;
}

function cubeSurfacePoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const builders = [
    (u: number, v: number): Particle3 => ({ x: u, y: v, z: 1 }),
    (u: number, v: number): Particle3 => ({ x: u, y: v, z: -1 }),
    (u: number, v: number): Particle3 => ({ x: u, y: 1, z: v }),
    (u: number, v: number): Particle3 => ({ x: u, y: -1, z: v }),
    (u: number, v: number): Particle3 => ({ x: 1, y: u, z: v }),
    (u: number, v: number): Particle3 => ({ x: -1, y: u, z: v }),
  ];
  const base = Math.floor(n / 6);
  const extra = n % 6;
  builders.forEach((builder, fi) => {
    const m = base + (fi < extra ? 1 : 0);
    const cols = Math.max(1, Math.ceil(Math.sqrt(m)));
    const rows = Math.max(1, Math.ceil(m / cols));
    for (let k = 0; k < m; k++) {
      const i = k % cols;
      const j = Math.floor(k / cols);
      const u = cols <= 1 ? 0 : (i / (cols - 1)) * 2 - 1;
      const v = rows <= 1 ? 0 : (j / (rows - 1)) * 2 - 1;
      pts.push(builder(u, v));
    }
  });
  return pts;
}

function cylinderSurfacePoints(n: number): Particle3[] {
  if (n < 6) return fibonacciSpherePoints(n);
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  const cap = Math.max(1, Math.round(n * 0.14));
  const lateral = n - 2 * cap;
  for (let i = 0; i < lateral; i++) {
    const z = -1 + ((i + 0.5) / lateral) * 2;
    const theta = ga * i;
    pts.push({ x: Math.cos(theta), y: Math.sin(theta), z });
  }
  for (let i = 0; i < cap; i++) {
    const rr = Math.sqrt((i + 0.5) / cap);
    const theta = ga * (i + 701);
    pts.push({ x: rr * Math.cos(theta), y: rr * Math.sin(theta), z: 1 });
  }
  for (let i = 0; i < cap; i++) {
    const rr = Math.sqrt((i + 0.5) / cap);
    const theta = ga * (i + 1403);
    pts.push({ x: rr * Math.cos(theta), y: rr * Math.sin(theta), z: -1 });
  }
  return pts;
}

function ellipsoidSurfacePoints(n: number): Particle3[] {
  return fibonacciSpherePoints(n).map((p) => ({ x: p.x * 1.14, y: p.y * 0.86, z: p.z * 1.06 }));
}

function torusSurfacePoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  const phi = Math.PI * (1 + Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const u = fract01((ga * i) / (Math.PI * 2)) * Math.PI * 2;
    const v = fract01(i * phi) * Math.PI * 2;
    const ring = 0.74 + 0.26 * Math.cos(v);
    pts.push({ x: ring * Math.cos(u), y: ring * Math.sin(u), z: 0.26 * Math.sin(v) });
  }
  return pts;
}

function capsuleSurfacePoints(n: number): Particle3[] {
  if (n < 14) return fibonacciSpherePoints(n);
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  const body = Math.max(3, Math.round(n * 0.5));
  const rest = n - body;
  const botCap = Math.floor(rest / 2);
  const topCap = rest - botCap;
  for (let i = 0; i < body; i++) {
    const z = -0.48 + ((i + 0.5) / body) * 0.96;
    const theta = ga * i;
    pts.push({ x: Math.cos(theta), y: Math.sin(theta), z });
  }
  for (let i = 0; i < botCap; i++) {
    const phi = (Math.PI / 2) * ((i + 0.5) / botCap);
    const theta = ga * (i + 313);
    pts.push({ x: Math.sin(phi) * Math.cos(theta), y: Math.sin(phi) * Math.sin(theta), z: -0.48 - Math.cos(phi) });
  }
  for (let i = 0; i < topCap; i++) {
    const phi = (Math.PI / 2) * ((i + 0.5) / topCap);
    const theta = ga * (i + 727);
    pts.push({ x: Math.sin(phi) * Math.cos(theta), y: Math.sin(phi) * Math.sin(theta), z: 0.48 + Math.cos(phi) });
  }
  return pts;
}

function octahedronSurfacePoints(n: number): Particle3[] {
  return fibonacciSpherePoints(n).map((p) => {
    const l1 = Math.abs(p.x) + Math.abs(p.y) + Math.abs(p.z) || 1;
    return { x: p.x / l1, y: p.y / l1, z: p.z / l1 };
  });
}

function doubleConeSurfacePoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = -1 + ((i + 0.5) / n) * 2;
    const r = 1 - Math.abs(z);
    const theta = ga * i;
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), z });
  }
  return pts;
}

function spiralRibbonPoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    const theta = u * Math.PI * 2 * 3.4;
    const band = ((i % 7) - 3) / 3;
    const r = 0.42 + u * 0.68 + band * 0.025;
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), z: -0.9 + u * 1.8 + band * 0.045 });
  }
  return pts;
}

function waveRingPoints(n: number): Particle3[] {
  const pts: Particle3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2;
    const band = ((i * 13) % 23) / 22 - 0.5;
    const r = 0.78 + band * 0.22;
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta), z: 0.22 * Math.sin(theta * 5 + ga * i) + band * 0.26 });
  }
  return pts;
}

function particlePointsForShape(kind: ParticleShapeKind, n: number): Particle3[] {
  switch (kind) {
    case 'sphere':
      return fibonacciSpherePoints(n);
    case 'ellipsoid':
      return ellipsoidSurfacePoints(n);
    case 'cube':
      return cubeSurfacePoints(n);
    case 'cylinder':
      return cylinderSurfacePoints(n);
    case 'torus':
      return torusSurfacePoints(n);
    case 'capsule':
      return capsuleSurfacePoints(n);
    case 'octahedron':
      return octahedronSurfacePoints(n);
    case 'doubleCone':
      return doubleConeSurfacePoints(n);
    case 'spiralRibbon':
      return spiralRibbonPoints(n);
    case 'waveRing':
      return waveRingPoints(n);
  }
}

function particlePaletteForStatus(status: string): { a: [number, number, number]; b: [number, number, number] } {
  if (status === 'ai_speaking') return { a: [0.52, 0.66, 1], b: [0.92, 0.78, 1] };
  if (status === 'listening') return { a: [0.5, 1, 0.78], b: [0.86, 1, 0.94] };
  if (status === 'live') return { a: [0.48, 0.95, 1], b: [0.9, 1, 0.96] };
  if (status === 'cooldown') return { a: [1, 0.78, 0.38], b: [1, 0.96, 0.72] };
  if (status === 'connecting') return { a: [0.42, 0.86, 1], b: [0.86, 0.98, 1] };
  if (status === 'error') return { a: [1, 0.42, 0.36], b: [1, 0.78, 0.68] };
  return { a: [0.64, 0.95, 1], b: [0.96, 1, 0.98] };
}

function easeMorphEdge(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

function morphBlend(nowMs: number): { ia: number; ib: number; blendU: number; labelShape: ParticleShapeKind } {
  const seg = PARTICLE_SHAPE_HOLD_MS + PARTICLE_SHAPE_MORPH_MS;
  const cycle = seg * PARTICLE_SHAPE_SEQUENCE.length;
  let e = nowMs % cycle;
  let idx = 0;
  while (e >= seg) {
    e -= seg;
    idx++;
  }
  const ia = idx % PARTICLE_SHAPE_SEQUENCE.length;
  const ib = (idx + 1) % PARTICLE_SHAPE_SEQUENCE.length;
  if (e < PARTICLE_SHAPE_HOLD_MS) return { ia, ib: ia, blendU: 0, labelShape: PARTICLE_SHAPE_SEQUENCE[ia] };
  const blendU = easeMorphEdge((e - PARTICLE_SHAPE_HOLD_MS) / PARTICLE_SHAPE_MORPH_MS);
  return { ia, ib, blendU, labelShape: blendU < 0.5 ? PARTICLE_SHAPE_SEQUENCE[ia] : PARTICLE_SHAPE_SEQUENCE[ib] };
}

function lerpParticle(a: Particle3, b: Particle3, u: number): Particle3 {
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u };
}

export function LiveParticleOrb({
  status,
  micLevelRef,
  muted = false,
  children,
}: {
  status: LiveParticleOrbStatus;
  micLevelRef?: React.RefObject<number>;
  muted?: boolean;
  children?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const shapePoints = useMemo(() => PARTICLE_SHAPE_SEQUENCE.map((kind) => particlePointsForShape(kind, LIVE_PARTICLE_DOT_COUNT)), []);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    setReduceMotion(media.matches);
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    let disposed = false;
    let cleanupThree: (() => void) | undefined;
    void (async () => {
      const [
        { AdditiveBlending },
        { BufferAttribute },
        { BufferGeometry },
        { PerspectiveCamera },
        { Points },
        { ShaderMaterial },
        { Scene },
        { WebGLRenderer },
        { Color },
      ] = await Promise.all([
        import('three/src/constants.js'),
        import('three/src/core/BufferAttribute.js'),
        import('three/src/core/BufferGeometry.js'),
        import('three/src/cameras/PerspectiveCamera.js'),
        import('three/src/objects/Points.js'),
        import('three/src/materials/ShaderMaterial.js'),
        import('three/src/scenes/Scene.js'),
        import('three/src/renderers/WebGLRenderer.js'),
        import('three/src/math/Color.js'),
      ]);
      if (disposed) return;

      const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

      const scene = new Scene();
      const camera = new PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.z = 4.9;

      const positions = new Float32Array(LIVE_PARTICLE_DOT_COUNT * 3);
      const seeds = new Float32Array(LIVE_PARTICLE_DOT_COUNT);
      for (let i = 0; i < LIVE_PARTICLE_DOT_COUNT; i++) seeds[i] = fract01(Math.sin(i * 91.345 + 17.17) * 43758.5453);

      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(positions, 3));
      geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
      const material = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uOpacity: { value: 0.84 },
          uSize: { value: 3.2 },
          uTime: { value: 0 },
          uColorA: { value: new Color(0.64, 0.95, 1) },
          uColorB: { value: new Color(0.96, 1, 0.98) },
        },
        vertexShader: `
          uniform float uSize;
          uniform float uTime;
          attribute float aSeed;
          varying float vSeed;
          varying float vTwinkle;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vSeed = aSeed;
            vTwinkle = 0.72 + 0.28 * sin(uTime * 1.45 + aSeed * 18.849);
            gl_PointSize = uSize * (0.82 + 0.32 * vTwinkle);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform float uOpacity;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          varying float vSeed;
          varying float vTwinkle;
          void main() {
            vec2 p = gl_PointCoord - vec2(0.5);
            float dist = length(p);
            float core = smoothstep(0.24, 0.0, dist);
            float halo = smoothstep(0.5, 0.13, dist);
            float alpha = (halo * 0.76 + core * 0.34) * uOpacity * (0.78 + 0.3 * vTwinkle);
            if (alpha < 0.015) discard;
            vec3 particleColor = mix(uColorA, uColorB, 0.36 + 0.46 * vSeed + 0.12 * vTwinkle);
            gl_FragColor = vec4(particleColor, alpha);
          }
        `,
      });
      const points = new Points(geometry, material);
      scene.add(points);

      const resize = () => {
        const rect = root.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(root);

      const tick = (now: number) => {
        const t = now * 0.001;
        const micRaw = muted ? 0 : (micLevelRef?.current ?? 0);
        let brainAmp = 0.48;
        if (status === 'ai_speaking') brainAmp = 1;
        else if (status === 'listening') brainAmp = 0.95;
        else if (status === 'live') brainAmp = 0.88;
        else if (status === 'connecting') brainAmp = 0.72;
        else if (status === 'cooldown') brainAmp = 0.68;

        const neural =
          brainAmp *
          (0.088 * Math.sin(t * 0.76) +
            0.056 * Math.sin(t * 1.63 + 1.18) +
            0.044 * Math.sin(t * 2.71 + 0.52) +
            0.028 * Math.sin(t * 4.35 + 2.05) +
            0.022 * Math.sin(t * 6.1 + 0.9));
        let voiceBoost = 0;
        let chatter = 0;
        if (status === 'ai_speaking') {
          const cadence = 0.5 + 0.5 * Math.sin(t * 11.5);
          chatter = 0.11 * cadence + 0.048 * Math.sin(t * 23);
        } else if (status === 'listening') {
          voiceBoost = micRaw * 0.52;
        } else if (status === 'live') {
          voiceBoost = micRaw * 0.42;
        }

        const scale = Math.min(1.2, Math.max(0.84, 1 + neural + voiceBoost + chatter));
        const blurMix =
          0.5 +
          0.5 *
            Math.sin(t * 0.61 + 1.05) *
            (0.56 + 0.44 * Math.sin(t * 1.88 + 0.33)) *
            (0.72 + 0.28 * Math.sin(t * 3.4 + 0.8));
        const sharpPulse = 1 - blurMix * 0.55;
        let glow = 0.22 + sharpPulse * 0.26;
        if (status === 'ai_speaking') glow += 0.34 + 0.26 * (0.5 + 0.5 * Math.sin(t * 11.5));
        else if (status === 'listening') glow += micRaw * 0.58;
        else if (status === 'live') glow += micRaw * 0.52;
        else glow += brainAmp * 0.14 * (0.5 + 0.5 * Math.sin(t * 2.2));
        glow = Math.min(1, Math.max(0.1, glow));

        const mb = reduceMotion ? { ia: 0, ib: 0, blendU: 0, labelShape: PARTICLE_SHAPE_SEQUENCE[0] } : morphBlend(now);
        root.dataset.particleShape = mb.labelShape;
        const A = shapePoints[mb.ia];
        const B = shapePoints[mb.ib];
        for (let i = 0; i < LIVE_PARTICLE_DOT_COUNT; i++) {
          const p = mb.blendU <= 0 ? A[i] : lerpParticle(A[i], B[i], mb.blendU);
          const j = i * 3;
          positions[j] = p.x * 1.04 * scale;
          positions[j + 1] = p.y * 1.04 * scale;
          positions[j + 2] = p.z * 1.04 * scale;
        }
        geometry.attributes.position.needsUpdate = true;

        const spinSpeed = status === 'listening' ? 0.28 : status === 'ai_speaking' ? 0.2 : ['live', 'connecting', 'cooldown'].includes(status) ? 0.23 : 0.16;
        points.rotation.y = t * spinSpeed;
        points.rotation.x = 0.22 + Math.sin(t * 0.27) * 0.1;
        points.rotation.z = Math.sin(t * 0.18) * 0.1;
        material.uniforms.uTime.value = t;
        material.uniforms.uOpacity.value = reduceMotion ? 0.78 : 0.68 + glow * 0.28;
        material.uniforms.uSize.value = status === 'ai_speaking' ? 3.4 : status === 'listening' ? 3.25 : 2.9;
        const palette = particlePaletteForStatus(status);
        material.uniforms.uColorA.value.setRGB(...palette.a);
        material.uniforms.uColorB.value.setRGB(...palette.b);
        renderer.render(scene, camera);
        animRef.current = requestAnimationFrame(tick);
      };

      animRef.current = requestAnimationFrame(tick);
      cleanupThree = () => {
        if (animRef.current != null) cancelAnimationFrame(animRef.current);
        resizeObserver.disconnect();
        delete root.dataset.particleShape;
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanupThree?.();
    };
  }, [micLevelRef, muted, reduceMotion, shapePoints, status]);

  return (
    <div className={`live-particle-orb${status !== 'idle' ? ' live-particle-orb--active' : ''}${reduceMotion ? ' live-particle-orb--reduce-motion' : ''}`} data-state={status === 'ai_speaking' ? 'ai' : status === 'listening' ? 'listening' : 'idle'} ref={rootRef}>
      <canvas ref={canvasRef} className="live-particle-orb__canvas" aria-hidden="true" />
      {children}
    </div>
  );
}
