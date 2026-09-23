"use client";
// Admin-only: turns a frame's 3D model into two realistic studio product photos —
// "folded" (arms folded behind the front) and "open" (three-quarter view) — with soft studio
// lighting and a contact shadow, on a transparent background so they sit on any page colour.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildAnyFrame, sourceFor } from "./frame-source";
import type { ProductDTO, VariantDTO } from "./types";

const RW = 1800, RH = 1350; // render size (supersampled)
const OW = 1200, OH = 900; // saved photo size

type Studio = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; key: THREE.DirectionalLight; ground: THREE.Mesh };
let studio: Studio | null = null;

function setup(): Studio {
  if (studio) return studio;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RW, RH, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe6f2, 0.5)); // low fill keeps black frames truly black
  const rimLight = new THREE.DirectionalLight(0xffffff, 1.2); // from behind: bright edge highlights like a product shoot
  rimLight.position.set(60, 160, -260);
  scene.add(rimLight);
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-220, 90, 140);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(22, RW / RH, 1, 6000);
  studio = { renderer, scene, camera, key, ground };
  return studio;
}

/** Folds the temple arms in behind the front, like glasses lying folded on a table. */
function foldTemples(group: THREE.Group) {
  const temples = group.getObjectByName("temples");
  if (!temples) return false;
  const arms = temples.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
  if (arms.length !== 2) return false;
  group.updateMatrixWorld(true);
  for (const arm of arms) {
    const pos = arm.geometry.attributes.position as THREE.BufferAttribute;
    // hinge = the arm's front end (highest z)
    let maxZ = -Infinity;
    for (let i = 0; i < pos.count; i++) maxZ = Math.max(maxZ, pos.getZ(i));
    const h = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) > maxZ - 1) { h.x += pos.getX(i); h.y += pos.getY(i); h.z += pos.getZ(i); n++; }
    h.divideScalar(Math.max(n, 1));
    const side = Math.sign(h.x) || 1;
    const pivot = new THREE.Group();
    pivot.position.copy(h);
    temples.add(pivot);
    arm.position.sub(h);
    pivot.add(arm);
    // right arm folds first and sits slightly behind the left, so they don't overlap
    pivot.rotation.y = side * Math.PI * (side > 0 ? 0.49 : 0.475);
    pivot.position.z -= side > 0 ? 6.5 : 2;
  }
  return true;
}

function shoot(s: Studio, group: THREE.Group, view: "folded" | "open"): HTMLCanvasElement {
  const box = new THREE.Box3().setFromObject(group);
  s.ground.position.y = box.min.y - 0.05; // the frame rests on the surface
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dir = view === "folded" ? new THREE.Vector3(0.42, 0.2, 1) : new THREE.Vector3(1.05, 0.34, 1);
  dir.normalize();
  const vFov = (s.camera.fov * Math.PI) / 180;
  const dist = (sphere.radius / Math.sin(vFov / 2)) * (view === "folded" ? 0.86 : 0.8);
  s.camera.position.copy(sphere.center).addScaledVector(dir, dist);
  s.camera.lookAt(sphere.center);
  s.camera.updateProjectionMatrix();
  s.key.position.set(sphere.center.x + 120, sphere.center.y + 260, sphere.center.z + 190);
  s.key.target.position.copy(sphere.center);
  const sc = s.key.shadow.camera as THREE.OrthographicCamera;
  const r = sphere.radius * 1.6;
  sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 1200;
  sc.updateProjectionMatrix();
  group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = m.name !== "lens"; } });
  s.renderer.render(s.scene, s.camera);
  // supersample down for smooth edges
  const out = document.createElement("canvas");
  out.width = OW;
  out.height = OH;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(s.renderer.domElement, 0, 0, OW, OH);
  return out;
}

async function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  const webp = await new Promise<Blob | null>((res) => c.toBlob(res, "image/webp", 0.88));
  if (webp && webp.type === "image/webp") return webp; // small and keeps transparency
  const png = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (!png) throw new Error("This browser could not save the photo.");
  return png;
}

/** Two studio photos for one colour: [folded, open]. */
export async function renderStudioShots(p: ProductDTO, v: VariantDTO): Promise<Blob[]> {
  const s = setup();
  const lens = p.category === "sunglasses" ? "sun" : "clear";
  const shots: Blob[] = [];
  for (const view of ["folded", "open"] as const) {
    const frame = await buildAnyFrame(sourceFor(p, v), p, lens);
    const root = new THREE.Group();
    root.add(frame.group);
    if (view === "folded") foldTemples(frame.group);
    s.scene.add(root);
    try {
      shots.push(await toBlob(shoot(s, root, view)));
    } finally {
      s.scene.remove(root);
      frame.dispose();
    }
  }
  return shots;
}
