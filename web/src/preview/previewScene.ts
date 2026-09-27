import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Mannequin } from './mannequin';

const BACKGROUND = 0x0f1219;
const GRID_SIZE = 10;
const GRID_DIVISIONS = 20;
const SHADOW_EXTENT = 2;
const CAMERA_POSITION = new THREE.Vector3(0, 1.2, 3.2);
const CAMERA_TARGET = new THREE.Vector3(0, 1, 0);

export interface PreviewScene {
  readonly mannequin: Mannequin;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x1a1e28, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(1.5, 4, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -SHADOW_EXTENT,
    right: SHADOW_EXTENT,
    top: SHADOW_EXTENT,
    bottom: -SHADOW_EXTENT,
    near: 0.5,
    far: 12,
  });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
}

function addFloor(scene: THREE.Scene): void {
  scene.add(new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0x3a4252, 0x222734));
  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.001;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);
  const axes = new THREE.AxesHelper(0.25);
  axes.position.y = 0.002;
  scene.add(axes);
}

/** Front view of the mannequin (it faces +Z, towards the camera), orbit controls, grid floor. */
export function createPreviewScene(container: HTMLElement): PreviewScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  scene.fog = new THREE.Fog(BACKGROUND, 6, 14);
  addLights(scene);
  addFloor(scene);

  const mannequin = new Mannequin();
  scene.add(mannequin.root);

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 50);
  camera.position.copy(CAMERA_POSITION);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(CAMERA_TARGET);
  controls.enableDamping = true;
  controls.minDistance = 1.2;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  return {
    mannequin,
    render() {
      controls.update();
      renderer.render(scene, camera);
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    dispose() {
      controls.dispose();
      mannequin.dispose();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
          node.geometry.dispose();
          const materials: THREE.Material[] = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
