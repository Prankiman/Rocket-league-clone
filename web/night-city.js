import * as THREE from 'three';
import {parkSource, fcolorLinearRGB} from './park-render-data.js';

const cameraPosition = new THREE.Vector3();
const unitScale = new THREE.Vector3(1, 1, 1);
const DEFAULT_SKYBOX = Object.freeze({ id: 'night-city', label: 'Night City', url: './assets/sky/night-city.webp', intensity: 1.2 });

// A one-draw equirectangular sky. Forcing z=w keeps the sphere on the far
// plane, so the panorama is independent of the viewer's far clip.
export function addSkybox(scene, renderer, {upload, reset} = {}) {
  const material = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      gl_Position.z = gl_Position.w;`,
    );
  };

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material);
  sky.name = 'Selectable skybox';
  sky.frustumCulled = false;
  sky.renderOrder = 100000; // After opaque geometry; far-plane depth rejects covered pixels.
  sky.matrixAutoUpdate = false;
  const rotation = new THREE.Quaternion();
  sky.onBeforeRender = (_renderer, _scene, camera) => {
    camera.getWorldPosition(cameraPosition);
    sky.matrixWorld.compose(cameraPosition, rotation, unitScale);
  };
  scene.add(sky);

  const textureLoader = new THREE.TextureLoader();
  let customUrl = null;
  let current = DEFAULT_SKYBOX;
  function load(url, intensity, done) {
    const loaded = textureLoader.load(url, texture => {
      if (done) done(texture);
    });
    loaded.colorSpace = THREE.SRGBColorSpace;
    if (renderer?.capabilities) loaded.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    material.map = loaded;
    material.color.setScalar(intensity);
    material.needsUpdate = true;
  }
  function useDefault() {
    if (customUrl) {
      URL.revokeObjectURL(customUrl);
      customUrl = null;
    }
    current = DEFAULT_SKYBOX;
    load(DEFAULT_SKYBOX.url, DEFAULT_SKYBOX.intensity);
    if (upload) upload.value = '';
  }
  function useUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      if (upload) upload.value = '';
      return;
    }
    if (customUrl) URL.revokeObjectURL(customUrl);
    customUrl = URL.createObjectURL(file);
    current = { id: 'custom', label: file.name, url: customUrl, intensity: 1 };
    load(customUrl, 1);
  }
  useDefault();
  upload?.addEventListener('change', () => useUpload(upload.files?.[0]));
  reset?.addEventListener('click', useDefault);
  return { reset: useDefault, upload: useUpload, get id() { return current.id; }, get label() { return current.label; }, sky };
}

// Night stadium lighting: the arena stays legible under a cool key light,
// while the surrounding park skyline falls into shadow.
export function addNightCityLighting(scene, renderer) {
  const rgb = bytes => new THREE.Color().setRGB(...fcolorLinearRGB(bytes));
  const sky = parkSource.skyLight.props;
  const ambient = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  ambient.color.copy(rgb(sky.LightColor)).multiplyScalar(sky.Brightness * 0.3);
  ambient.groundColor.copy(rgb(sky.LowerColor)).multiplyScalar(sky.LowerBrightness * 0.1);
  ambient.name = 'Night city sky ambient';
  scene.add(ambient);

  const source = parkSource.directionalLights[0];
  const key = new THREE.DirectionalLight(0xdfe9ff, 1.35);
  key.position.fromArray(source.directionToLightWebGL).multiplyScalar(180);
  key.name = 'Night city stadium key';
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -100, right: 100, top: 100, bottom: -100, near: 1, far: 400});
  key.shadow.normalBias = .04;
  key.shadow.bias = -.0001;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x5577cc, 0.28);
  fill.position.set(-120, 60, 90);
  fill.name = 'Night city cool fill';
  scene.add(fill);
  const stadium = new THREE.PointLight(0xffffff, 2.2, 420, 2);
  stadium.position.set(0, 145, 0);
  stadium.name = 'Beckwith Park stadium light source';
  scene.add(stadium);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  scene.fog = null;
  return key;
}
