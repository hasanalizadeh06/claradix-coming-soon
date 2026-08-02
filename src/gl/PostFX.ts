import * as THREE from "three";

/**
 * Post-processing chain: HDR target → threshold → mip blur → composite.
 *
 * Written by hand rather than pulled from a package for two reasons. The
 * `postprocessing` library is ~80KB gzipped for effects we use a fraction of,
 * and three's own UnrealBloomPass runs a fixed five-level separable Gaussian
 * that is heavier than it needs to be on mobile. This is a dual-filter
 * (Kawase-style) bloom: 13-tap downsample, 9-tap tent upsample. Roughly a third
 * of the cost at equal visual quality, and the mip count adapts to the device.
 *
 * Colour management is explicit. The renderer is left in linear space and this
 * chain does tone mapping and sRGB encoding itself, so there is exactly one
 * place where a colour transform can go wrong.
 */

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const PREFILTER = /* glsl */ `
precision highp float;
uniform sampler2D tSource;
uniform vec3 uThreshold; // x: threshold, y: knee, z: 2*knee
varying vec2 vUv;

void main(){
  vec3 c = texture2D(tSource, vUv).rgb;
  float brightness = max(c.r, max(c.g, c.b));
  // Soft knee keeps the bloom from snapping on at a hard cutoff.
  float soft = clamp(brightness - uThreshold.x + uThreshold.y, 0.0, uThreshold.z);
  soft = soft * soft / (4.0 * uThreshold.y + 0.0001);
  float contribution = max(soft, brightness - uThreshold.x) / max(brightness, 0.0001);
  gl_FragColor = vec4(c * contribution, 1.0);
}
`;

const DOWNSAMPLE = /* glsl */ `
precision highp float;
uniform sampler2D tSource;
uniform vec2 uTexel;
varying vec2 vUv;

void main(){
  vec2 t = uTexel;
  vec3 a = texture2D(tSource, vUv + t * vec2(-2.0,  2.0)).rgb;
  vec3 b = texture2D(tSource, vUv + t * vec2( 0.0,  2.0)).rgb;
  vec3 c = texture2D(tSource, vUv + t * vec2( 2.0,  2.0)).rgb;
  vec3 d = texture2D(tSource, vUv + t * vec2(-2.0,  0.0)).rgb;
  vec3 e = texture2D(tSource, vUv).rgb;
  vec3 f = texture2D(tSource, vUv + t * vec2( 2.0,  0.0)).rgb;
  vec3 g = texture2D(tSource, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture2D(tSource, vUv + t * vec2( 0.0, -2.0)).rgb;
  vec3 i = texture2D(tSource, vUv + t * vec2( 2.0, -2.0)).rgb;
  vec3 j = texture2D(tSource, vUv + t * vec2(-1.0,  1.0)).rgb;
  vec3 k = texture2D(tSource, vUv + t * vec2( 1.0,  1.0)).rgb;
  vec3 l = texture2D(tSource, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture2D(tSource, vUv + t * vec2( 1.0, -1.0)).rgb;

  vec3 result = e * 0.125;
  result += (a + c + g + i) * 0.03125;
  result += (b + d + f + h) * 0.0625;
  result += (j + k + l + m) * 0.125;
  gl_FragColor = vec4(result, 1.0);
}
`;

const UPSAMPLE = /* glsl */ `
precision highp float;
uniform sampler2D tSource;
uniform vec2 uTexel;
uniform float uRadius;
varying vec2 vUv;

void main(){
  vec2 t = uTexel * uRadius;
  vec3 result = texture2D(tSource, vUv + t * vec2(-1.0,  1.0)).rgb * 1.0;
  result += texture2D(tSource, vUv + t * vec2( 0.0,  1.0)).rgb * 2.0;
  result += texture2D(tSource, vUv + t * vec2( 1.0,  1.0)).rgb * 1.0;
  result += texture2D(tSource, vUv + t * vec2(-1.0,  0.0)).rgb * 2.0;
  result += texture2D(tSource, vUv).rgb * 4.0;
  result += texture2D(tSource, vUv + t * vec2( 1.0,  0.0)).rgb * 2.0;
  result += texture2D(tSource, vUv + t * vec2(-1.0, -1.0)).rgb * 1.0;
  result += texture2D(tSource, vUv + t * vec2( 0.0, -1.0)).rgb * 2.0;
  result += texture2D(tSource, vUv + t * vec2( 1.0, -1.0)).rgb * 1.0;
  gl_FragColor = vec4(result / 16.0, 1.0);
}
`;

/**
 * The accumulator's update: fade what was there, add what is there now.
 *
 * The fade is a MULTIPLY rather than a subtract, so a streak decays
 * exponentially and never reaches an abrupt end. A linear fade gives every trail
 * the same length regardless of how bright its particle was, which reads as a
 * ribbon dragged behind the river rather than as light dying away.
 */
const TRAIL_ACCUM = /* glsl */ `
precision highp float;
uniform sampler2D tPrevious;
uniform sampler2D tCurrent;
uniform float uDecay;
varying vec2 vUv;

void main(){
  vec3 previous = texture2D(tPrevious, vUv).rgb * uDecay;
  vec3 current  = texture2D(tCurrent,  vUv).rgb;

  // CLAMPED. A streak may never be brighter than the particle that made it.
  //
  // Unclamped, a pixel the river crosses slowly — the far end, where
  // perspective compresses the stream — receives contribution after
  // contribution and converges on 1/(1-decay), or 8.3x. Those regions saturate
  // to white, the green goes out of them, and the river stops looking like
  // particles and starts looking like a solid bar of light travelling at speed.
  //
  // The near end, crossed quickly, never accumulates enough to notice. So the
  // artefact appears exactly where the stream is most compressed, which is also
  // where it is most visible.
  gl_FragColor = vec4(min(previous + current, vec3(1.0)), 1.0);
}
`;

/**
 * Adds the accumulator back into the scene, at a fraction of its own strength.
 *
 * The particles are drawn again in full on top, so the accumulator is only ever
 * supplying the smear BEHIND them. At full strength the trail is as bright as
 * the thing casting it and the river turns into a solid band of light.
 */
const TRAIL_ADD = /* glsl */ `
precision highp float;
uniform sampler2D tSource;
uniform float uStrength;
varying vec2 vUv;

void main(){
  gl_FragColor = vec4(texture2D(tSource, vUv).rgb * uStrength, 1.0);
}
`;

const COMPOSITE = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tDepth;
uniform float uBloomStrength;
uniform float uFocusDistance;
uniform float uFocusRange;
uniform float uMaxBlur;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uAberration;
uniform float uGrain;
uniform float uVignette;
uniform float uExposure;
uniform float uTime;
uniform float uFade;
uniform vec2 uResolution;
varying vec2 vUv;

// Narkowicz 2015 ACES approximation — one multiply-add richer than Reinhard and
// keeps saturated greens from clipping to white at the bloom cores.
vec3 acesFilm(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 toSRGB(vec3 c){
  return mix(
    1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    c * 12.92,
    step(c, vec3(0.0031308))
  );
}

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/** Non-linear depth back to metres. */
float linearDepth(float rawDepth){
  float ndc = rawDepth * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
}

/**
 * Depth of field, at the smallest scale that still does anything.
 *
 * A six-tap ring rather than a separable Gaussian: at this blur radius — under
 * two pixels even at the extremes — a full Gaussian is spending bandwidth to
 * resolve detail that is being deliberately destroyed. What matters is only
 * that the far span and the foreground motes lose their edges slightly, so the
 * eye reads the bridge as the plane it is focused on.
 */
vec3 sampleDefocused(vec2 uv, float radius){
  if (radius < 0.35) return texture2D(tScene, uv).rgb;

  vec3 sum = texture2D(tScene, uv).rgb;
  vec2 r = uTexel * radius;
  sum += texture2D(tScene, uv + vec2( 0.87,  0.50) * r).rgb;
  sum += texture2D(tScene, uv + vec2(-0.87,  0.50) * r).rgb;
  sum += texture2D(tScene, uv + vec2( 0.00,  1.00) * r).rgb;
  sum += texture2D(tScene, uv + vec2( 0.87, -0.50) * r).rgb;
  sum += texture2D(tScene, uv + vec2(-0.87, -0.50) * r).rgb;
  sum += texture2D(tScene, uv + vec2( 0.00, -1.00) * r).rgb;
  return sum / 7.0;
}

void main(){
  vec2 centered = vUv - 0.5;
  float r2 = dot(centered, centered);

  // Radial chromatic aberration: strongest at the frame edge, absent at centre,
  // which is where the headline sits. Text never smears.
  // Circle of confusion from the depth buffer. Symmetric about the focal
  // plane, so the foreground softens as well as the distance — one-sided DOF
  // is the tell of a fake.
  float depth = linearDepth(texture2D(tDepth, vUv).x);
  float coc = clamp(abs(depth - uFocusDistance) / uFocusRange, 0.0, 1.0);
  float blurRadius = coc * coc * uMaxBlur;

  vec2 offset = centered * uAberration * r2;
  vec3 scene;
  scene.r = sampleDefocused(vUv + offset, blurRadius).r;
  scene.g = sampleDefocused(vUv, blurRadius).g;
  scene.b = sampleDefocused(vUv - offset, blurRadius).b;

  vec3 bloom = texture2D(tBloom, vUv).rgb;
  vec3 color = scene + bloom * uBloomStrength;

  color *= uExposure;
  color = acesFilm(color);
  color = toSRGB(color);

  // Vignette applied after encoding so it reads as a lens property rather than
  // as a change in scene lighting.
  color *= 1.0 - uVignette * smoothstep(0.15, 0.75, r2);

  // Animated grain breaks up banding in the large dark gradients, which is
  // where 8-bit output falls apart on this palette.
  float noise = hash12(gl_FragCoord.xy + uTime * 60.0);
  color += (noise - 0.5) * uGrain;

  // Temporal dither, applied last, immediately before the eight-bit write.
  // Two independent samples subtracted give a triangular distribution rather
  // than a uniform one, which removes the residual banding a single sample
  // leaves behind — and because it changes every frame the eye integrates it
  // away entirely, so the noise floor costs nothing visually.
  float d1 = hash12(gl_FragCoord.xy + uTime * 131.0);
  float d2 = hash12(gl_FragCoord.xy + uTime * 71.0 + 17.3);
  color += (d1 - d2) / 255.0;

  gl_FragColor = vec4(color * uFade, 1.0);
}
`;

export interface PostFXOptions {
  bloom: boolean;
  bloomStrength?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
  /** Motion trails behind the flying particles. Costs one extra pass over the
   *  particle system, at half resolution. */
  trails?: boolean;
  /** Per-frame multiplier on the accumulator. 0.88 gives a ~26-frame streak. */
  trailDecay?: number;
  /** How much of the accumulator is added back. Below 1 because the particles
   *  are also drawn in full on top of it. */
  trailStrength?: number;
  aberration?: number;
  grain?: number;
  vignette?: number;
  exposure?: number;
  /** Max defocus blur in pixels. 0 disables depth of field entirely. */
  defocus?: number;
  focusDistance?: number;
  focusRange?: number;
  maxMips?: number;
}

export class PostFX {
  private renderer: THREE.WebGLRenderer;
  private options: Required<PostFXOptions>;

  private fsScene = new THREE.Scene();
  private fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private fsMesh: THREE.Mesh;

  private sceneTarget!: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];

  /**
   * Where the atmosphere pass writes. Everything downstream — bloom, composite
   * — reads this instead of the raw scene once a pass is installed, so the fog
   * and sky are bloomed and graded exactly like the geometry rather than being
   * pasted on afterwards.
   */
  private atmosphereTarget: THREE.WebGLRenderTarget | null = null;
  private atmosphereMaterial: THREE.ShaderMaterial | null = null;

  /**
   * THE TRAILS.
   *
   * Two targets that swap each frame, holding a decaying record of where the
   * particles have been:
   *
   *     accum = previous * decay + this frame's particles
   *
   * At decay 0.88 a streak is down to 3.6% after 26 frames, which is where the
   * specified trail length comes from — it is the same number stated two ways.
   *
   * HALF RESOLUTION, deliberately. This is the scene's most fill-bound pass and
   * it is drawn again in full, on top, every frame; the accumulator only has to
   * carry the smear behind each particle, and a smear does not need pixels. It
   * also softens the streak for free, which a full-resolution version has to
   * spend a blur on.
   *
   * A feedback buffer is the one place in this scene where state accumulates
   * across frames. Everything else is a pure function of time — which is what
   * makes seeking work — so the accumulator is reset on seek rather than being
   * allowed to smear a frame from ten seconds ago across the one being measured.
   */
  private trailA: THREE.WebGLRenderTarget | null = null;
  private trailB: THREE.WebGLRenderTarget | null = null;
  private trailScratch: THREE.WebGLRenderTarget | null = null;
  private matTrailAccum: THREE.ShaderMaterial | null = null;
  private matTrailAdd: THREE.ShaderMaterial | null = null;
  private trailDirty = true;

  private matPrefilter: THREE.ShaderMaterial;
  private matDown: THREE.ShaderMaterial;
  private matUp: THREE.ShaderMaterial;
  private matComposite: THREE.ShaderMaterial;

  private width = 1;
  private height = 1;

  constructor(renderer: THREE.WebGLRenderer, options: PostFXOptions) {
    this.renderer = renderer;
    this.options = {
      bloom: options.bloom,
      bloomStrength: options.bloomStrength ?? 0.9,
      bloomThreshold: options.bloomThreshold ?? 0.55,
      bloomRadius: options.bloomRadius ?? 1.0,
      trails: options.trails ?? false,
      trailDecay: options.trailDecay ?? 0.88,
      trailStrength: options.trailStrength ?? 0.55,
      aberration: options.aberration ?? 0.0032,
      grain: options.grain ?? 0.028,
      vignette: options.vignette ?? 0.55,
      exposure: options.exposure ?? 1.0,
      defocus: options.defocus ?? 0,
      focusDistance: options.focusDistance ?? 700,
      focusRange: options.focusRange ?? 900,
      maxMips: options.maxMips ?? 5,
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.fsMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    this.fsMesh.frustumCulled = false;
    this.fsScene.add(this.fsMesh);

    const base = { depthTest: false, depthWrite: false, vertexShader: VERT };

    this.matPrefilter = new THREE.ShaderMaterial({
      ...base,
      fragmentShader: PREFILTER,
      uniforms: {
        tSource: { value: null },
        uThreshold: { value: new THREE.Vector3() },
      },
    });

    this.matDown = new THREE.ShaderMaterial({
      ...base,
      fragmentShader: DOWNSAMPLE,
      uniforms: {
        tSource: { value: null },
        uTexel: { value: new THREE.Vector2() },
      },
    });

    this.matUp = new THREE.ShaderMaterial({
      ...base,
      fragmentShader: UPSAMPLE,
      blending: THREE.AdditiveBlending,
      transparent: true,
      uniforms: {
        tSource: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: this.options.bloomRadius },
      },
    });

    this.matComposite = new THREE.ShaderMaterial({
      ...base,
      fragmentShader: COMPOSITE,
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uBloomStrength: { value: this.options.bloom ? this.options.bloomStrength : 0 },
        uAberration: { value: this.options.aberration },
        uGrain: { value: this.options.grain },
        uVignette: { value: this.options.vignette },
        uExposure: { value: this.options.exposure },
        uTime: { value: 0 },
        uFade: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uNear: { value: 0.1 },
        uFar: { value: 400 },
        // Focused on the near tower. Everything nearer and everything beyond it
        // softens, which is what puts the structure on the focal plane and the
        // world either side of it.
        uFocusDistance: { value: this.options.focusDistance },
        uFocusRange: { value: this.options.focusRange },
        // Defaults to 0 — NO DEPTH OF FIELD.
        //
        // The bridge is a point cloud and its point structure IS the subject;
        // defocusing it turns 140,000 discrete arrivals into a smooth smear.
        // This was previously fixed at 1.7 with a focus plane at 120 units,
        // tuned for a world whose near tower sat at that distance. In the
        // current world the bridge spans 700-1500 units, so every particle was
        // beyond the focus range and the whole structure was being blurred —
        // which measured as an 18% mid-tone wash and read as bloom.
        uMaxBlur: { value: this.options.defocus },
      },
    });

    /**
     * Dev-only handles for A/B-ing the post chain at runtime.
     *
     * Every previous attempt to fix a colour-ratio failure by reasoning about
     * which element was too bright picked the wrong element. Being able to zero
     * one term and re-measure turns that into a two-minute experiment instead of
     * a rebuild per guess. See scripts/palette-check.mjs.
     */
    if (import.meta.env.DEV && typeof window !== "undefined") {
      (window as unknown as { __post?: Record<string, (v: number) => void> }).__post =
        {
          bloom: (v) => {
            this.matComposite.uniforms.uBloomStrength.value = v;
          },
          grain: (v) => {
            this.matComposite.uniforms.uGrain.value = v;
          },
          vignette: (v) => {
            this.matComposite.uniforms.uVignette.value = v;
          },
          exposure: (v) => {
            this.matComposite.uniforms.uExposure.value = v;
          },
          defocus: (v) => {
            this.matComposite.uniforms.uMaxBlur.value = v;
          },
          // Strength and radius are not interchangeable and the difference
          // decides the colour ratio: strength scales the halo's brightness,
          // radius its AREA. Spreading the same energy wider adds mid-tone
          // pixels without adding a single bright one, so it costs the deep
          // band and gives nothing to the accent band in return.
          bloomRadius: (v) => {
            this.matUp.uniforms.uRadius.value = v;
          },
          bloomThreshold: (v) => {
            const knee = v * 0.5 + 1e-5;
            this.matPrefilter.uniforms.uThreshold.value.set(v, knee, knee * 2);
          },
          // The halo's true extent. `bloomRadius` only widens the up-sample tent
          // by a few texels; the mip DEPTH is what decides how far a bright pixel
          // throws light, because each level halves the resolution the glow is
          // reconstructed from. Rebuilds the chain, so it is a dev lever only.
          bloomMips: (v) => {
            this.options.maxMips = v;
            this.setSize(this.width, this.height);
          },
        };
    }
  }

  /**
   * Installs a fullscreen pass that runs between the scene and the bloom chain,
   * with the scene colour and the scene *depth* bound to it.
   *
   * Depth is the whole point. A pass that can read it can work out where every
   * surface in the frame actually is, which is what allows fog, sky and
   * distance to be one computation instead of a backdrop image and a per-object
   * fade that only agree by coincidence.
   */
  setAtmospherePass(material: THREE.ShaderMaterial | null) {
    this.atmosphereMaterial = material;
    if (material && !this.atmosphereTarget) this.allocateAtmosphereTarget();
  }

  private allocateAtmosphereTarget() {
    this.atmosphereTarget?.dispose();
    this.atmosphereTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    });
  }

  /** 0 → black, 1 → full scene. Drives the reveal after the first frame lands. */
  setFade(value: number) {
    this.matComposite.uniforms.uFade.value = value;
  }

  /**
   * Bloom strength for THIS frame.
   *
   * Bloom is not a constant here. A scene that is dark and empty at the start
   * and made of light at the end cannot use one strength for both: the value
   * that lets the finished bridge glow turns the opening haze into a wash, and
   * the value that keeps the opening clean leaves the finish inert. Measured,
   * pinned at a single 0.85: the glide frames ran 10 points over their deep-band
   * budget while the settled frames ran 3 points UNDER their accent target — the
   * same constant failing in opposite directions at opposite ends of the build,
   * which is what a missing curve looks like.
   *
   * Ignored while bloom is disabled, so a low-tier device is not quietly given
   * a bloom pass by an animation frame.
   */
  /**
   * Quality knobs for the degradation ladder.
   *
   * Deliberately separate from the `window.__post` dev hooks, which exist only
   * in development builds and only to answer questions during an investigation.
   * A production feature reaching for a debug hook is a production feature that
   * disappears in production.
   */
  getAberration() {
    return this.matComposite.uniforms.uAberration.value as number;
  }

  setAberration(value: number) {
    this.matComposite.uniforms.uAberration.value = value;
  }

  getGrain() {
    return this.matComposite.uniforms.uGrain.value as number;
  }

  setGrain(value: number) {
    this.matComposite.uniforms.uGrain.value = value;
  }

  getTrails() {
    return this.options.trails;
  }

  setTrails(on: boolean) {
    if (on === this.options.trails) return;
    this.options.trails = on;
    // Turning them back on starts from nothing rather than from a buffer that
    // has been sitting untouched — otherwise the first frame after recovery
    // slams a several-second-old smear onto the screen.
    this.trailDirty = true;
    this.setSize(this.width, this.height);
  }

  getBloomMips() {
    return this.options.maxMips;
  }

  setBloomMips(value: number) {
    if (value === this.options.maxMips) return;
    this.options.maxMips = value;
    // Rebuilds the chain. Costly enough that the governor's hysteresis matters:
    // doing this every other window would itself be the performance problem.
    this.setSize(this.width, this.height);
  }

  setBloomStrength(value: number) {
    this.options.bloomStrength = value;
    if (this.options.bloom) {
      this.matComposite.uniforms.uBloomStrength.value = value;
    }
  }

  setSize(width: number, height: number) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));

    const targetOptions: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    };

    if (!this.sceneTarget) {
      this.sceneTarget = new THREE.WebGLRenderTarget(
        this.width,
        this.height,
        targetOptions,
      );
      // A real depth attachment, not just a depth buffer: the atmosphere pass
      // has to sample it. UnsignedInt (24-bit) rather than a float depth —
      // precision is ample over this scene's 400-unit far plane and it is the
      // format every target platform supports without an extension.
      const depthTexture = new THREE.DepthTexture(this.width, this.height);
      depthTexture.type = THREE.UnsignedIntType;
      depthTexture.minFilter = THREE.NearestFilter;
      depthTexture.magFilter = THREE.NearestFilter;
      this.sceneTarget.depthTexture = depthTexture;
    } else {
      this.sceneTarget.setSize(this.width, this.height);
    }

    if (this.atmosphereMaterial) this.allocateAtmosphereTarget();
    this.allocateTrailTargets(targetOptions);

    for (const mip of this.mips) mip.dispose();
    this.mips = [];

    if (!this.options.bloom) return;

    let w = this.width;
    let h = this.height;
    for (let i = 0; i < this.options.maxMips; i++) {
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
      if (w < 8 || h < 8) break;
      this.mips.push(
        new THREE.WebGLRenderTarget(w, h, { ...targetOptions, depthBuffer: false }),
      );
    }

    this.matComposite.uniforms.uResolution.value.set(this.width, this.height);
  }

  private allocateTrailTargets(targetOptions: THREE.RenderTargetOptions) {
    for (const t of [this.trailA, this.trailB, this.trailScratch]) t?.dispose();
    this.trailA = this.trailB = this.trailScratch = null;

    if (!this.options.trails) return;

    const w = Math.max(1, Math.floor(this.width / 2));
    const h = Math.max(1, Math.floor(this.height / 2));
    const options = { ...targetOptions, depthBuffer: false };

    this.trailA = new THREE.WebGLRenderTarget(w, h, options);
    this.trailB = new THREE.WebGLRenderTarget(w, h, options);
    // Its own depth buffer: the particle pass is depth-tested against the
    // terrain, or the trails hang in front of mountains they are behind.
    this.trailScratch = new THREE.WebGLRenderTarget(w, h, {
      ...targetOptions,
      depthBuffer: true,
    });

    this.matTrailAccum ??= new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: TRAIL_ACCUM,
      uniforms: {
        tPrevious: { value: null },
        tCurrent: { value: null },
        uDecay: { value: this.options.trailDecay },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.matTrailAdd ??= new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: TRAIL_ADD,
      uniforms: {
        tSource: { value: null },
        uStrength: { value: this.options.trailStrength },
      },
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });

    this.trailDirty = true;
  }

  /**
   * Throws away the accumulated history.
   *
   * The accumulator is the one thing in this scene that remembers previous
   * frames. Everything else is a pure function of time, which is what makes
   * seeking possible — so after a seek this buffer holds a smear from wherever
   * the clock used to be, and would drag it across the frame being measured.
   */
  clearTrails() {
    this.trailDirty = true;
  }

  private blit(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.fsMesh.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCamera);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.Camera,
    elapsed: number,
    trailLayer?: number,
  ) {
    const renderer = this.renderer;

    const perspective = camera as THREE.PerspectiveCamera;
    if (perspective.isPerspectiveCamera) {
      this.matComposite.uniforms.uNear.value = perspective.near;
      this.matComposite.uniforms.uFar.value = perspective.far;
    }

    // Release the scene target's own textures before rendering into it.
    // They are still bound from last frame's atmosphere and composite passes,
    // and a target that is simultaneously a bound texture and the framebuffer
    // is a feedback loop — WebGL rejects the draw outright.
    if (this.atmosphereMaterial) {
      this.atmosphereMaterial.uniforms.tScene.value = null;
      this.atmosphereMaterial.uniforms.tDepth.value = null;
    }
    this.matComposite.uniforms.tScene.value = null;
    this.matComposite.uniforms.tDepth.value = null;

    // --- trails -----------------------------------------------------------
    //
    // Runs BEFORE the scene, because the scene pass is what will draw the
    // particles at full brightness on top of their own smear.
    //
    // The particles-only pass uses a camera layer rather than a second scene:
    // one scene graph, one set of matrices, no chance of the two drifting apart.
    // The scene opts in by publishing `trailLayer`, and a scene that does not
    // simply never gets a trail pass.
    const trail =
      this.options.trails &&
      this.trailA &&
      this.trailB &&
      this.trailScratch &&
      this.matTrailAccum &&
      this.matTrailAdd &&
      typeof trailLayer === "number"
        ? {
            a: this.trailA,
            b: this.trailB,
            scratch: this.trailScratch,
            accum: this.matTrailAccum,
            add: this.matTrailAdd,
            layer: trailLayer,
          }
        : null;

    if (trail) {
      const cam = camera as THREE.PerspectiveCamera;
      const mask = cam.layers.mask;

      cam.layers.set(trail.layer);

      // The background has to go, and this is not a detail.
      //
      // `renderer.render` clears with `scene.background` when one is set, so the
      // trail pass would start every frame filled with the fallback sky colour —
      // and the accumulator would then sum it geometrically: at decay 0.88 that
      // is 1/(1-0.88) = 8.3x, a flat lift of about 0.11 luminance across the
      // WHOLE frame, added to a scene whose entire near-black band lives below
      // 0.058. Measured as two points of near-black lost at every capture
      // including `dormant`, where the particles are suppressed and nothing
      // should have changed at all.
      //
      // That symptom is what gave it away: a trail effect cannot brighten a
      // frame with no moving particles in it, so whatever was brightening it was
      // not the trails.
      const background = scene.background;
      scene.background = null;

      renderer.setRenderTarget(trail.scratch);
      renderer.clear();
      renderer.render(scene, camera);

      scene.background = background;
      cam.layers.mask = mask;

      // accum = previous * decay + this frame. On the first frame after a seek
      // there is no meaningful previous, so the decay is dropped to zero rather
      // than dragging the old clock's smear into the new one.
      trail.accum.uniforms.tPrevious.value = trail.b.texture;
      trail.accum.uniforms.tCurrent.value = trail.scratch.texture;
      trail.accum.uniforms.uDecay.value = this.trailDirty
        ? 0
        : this.options.trailDecay;
      this.trailDirty = false;
      this.blit(trail.accum, trail.a);

      this.trailA = trail.b;
      this.trailB = trail.a;
    }

    renderer.setRenderTarget(this.sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);

    if (trail) {
      // Additive, on top of the scene we just drew. Reads one target and writes
      // a different one, so there is no feedback loop to trip over — and
      // autoClear has to be off or the blit erases the frame it is adding to.
      // trailB, not trail.b — the pair was swapped above, so this is the target
      // just written into rather than the one it was accumulated from.
      trail.add.uniforms.tSource.value = trail.a.texture;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      this.blit(trail.add, this.sceneTarget);
      renderer.autoClear = autoClear;
    }

    // The atmosphere runs on the whole frame, before anything else looks at it.
    // From here on `source` is the world with its air in it.
    let source = this.sceneTarget;
    if (this.atmosphereMaterial && this.atmosphereTarget) {
      this.atmosphereMaterial.uniforms.tScene.value = this.sceneTarget.texture;
      this.atmosphereMaterial.uniforms.tDepth.value = this.sceneTarget.depthTexture;
      this.blit(this.atmosphereMaterial, this.atmosphereTarget);
      source = this.atmosphereTarget;
    }

    if (this.options.bloom && this.mips.length > 0) {
      const t = this.options.bloomThreshold;
      const knee = t * 0.6 + 0.0001;
      this.matPrefilter.uniforms.tSource.value = source.texture;
      this.matPrefilter.uniforms.uThreshold.value.set(t, knee, knee * 2);
      this.blit(this.matPrefilter, this.mips[0]);

      for (let i = 1; i < this.mips.length; i++) {
        const src = this.mips[i - 1];
        this.matDown.uniforms.tSource.value = src.texture;
        this.matDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.blit(this.matDown, this.mips[i]);
      }

      // Walk back up, adding each blurred level onto the one above it. The
      // additive blend is what produces the wide, soft falloff without ever
      // running a large-kernel blur at full resolution.
      for (let i = this.mips.length - 1; i > 0; i--) {
        const src = this.mips[i];
        this.matUp.uniforms.tSource.value = src.texture;
        this.matUp.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.blit(this.matUp, this.mips[i - 1]);
      }

      this.matComposite.uniforms.tBloom.value = this.mips[0].texture;
    } else {
      this.matComposite.uniforms.tBloom.value = source.texture;
      this.matComposite.uniforms.uBloomStrength.value = 0;
    }

    this.matComposite.uniforms.tScene.value = source.texture;
    this.matComposite.uniforms.tDepth.value = this.sceneTarget.depthTexture;
    this.matComposite.uniforms.uTexel.value.set(1 / this.width, 1 / this.height);
    this.matComposite.uniforms.uTime.value = elapsed;
    this.blit(this.matComposite, null);
  }

  dispose() {
    this.sceneTarget?.depthTexture?.dispose();
    this.sceneTarget?.dispose();
    this.atmosphereTarget?.dispose();
    for (const mip of this.mips) mip.dispose();
    this.mips = [];
    this.matPrefilter.dispose();
    this.matDown.dispose();
    this.matUp.dispose();
    this.matComposite.dispose();
    this.fsMesh.geometry.dispose();
  }
}
