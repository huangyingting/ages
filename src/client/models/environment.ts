import * as THREE from 'three';

/**
 * Image-based lighting for the 3D models: a small procedural outdoor environment (sky above, bright hazy horizon,
 * darker ground below; +Y is "up"). It gives every model soft sky light from above, a little ground bounce from
 * below, and real reflections on glossy and metal parts. Prefiltered once per renderer (PMREM), so it costs one
 * texture lookup per pixel afterwards.
 */
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = /* glsl */`
varying vec3 vDir;
void main() {
  float y = normalize(vDir).y;
  vec3 zenith = vec3(0.3, 0.46, 0.74);
  vec3 horizon = vec3(0.78, 0.78, 0.76);
  vec3 ground = vec3(0.12, 0.12, 0.11);
  vec3 sky = mix(horizon, zenith, pow(smoothstep(0.0, 1.0, y), 0.6));
  vec3 below = mix(horizon * 0.45, ground, smoothstep(0.0, 0.25, -y));
  vec3 c = y >= 0.0 ? sky : below;
  // a broad bright patch high in the sky, so glossy tops pick up a soft sheen
  c += vec3(1.0, 0.95, 0.85) * 1.2 * pow(max(dot(normalize(vDir), normalize(vec3(0.45, 0.8, 0.4))), 0.0), 24.0);
  gl_FragColor = vec4(c, 1.0);
}`;

const cache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

export function outdoorEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  let tex = cache.get(renderer);
  if (tex) return tex;
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(1, 48, 24);
  const mat = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false });
  scene.add(new THREE.Mesh(geo, mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  tex = pmrem.fromScene(scene, 0, 0.1, 10).texture;
  pmrem.dispose(); geo.dispose(); mat.dispose();
  cache.set(renderer, tex);
  return tex;
}

const qUp = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
/** Points the environment's "up" along `up` (the local vertical where the models stand). */
export function orientEnvironment(scene: THREE.Scene, up: THREE.Vector3): void {
  // the renderer samples with the transpose of this rotation, i.e. world → environment
  scene.environmentRotation.setFromQuaternion(qUp.setFromUnitVectors(Y, up));
}
