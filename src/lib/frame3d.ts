// Client-only: builds a real 3D pair of glasses (millimetre units) from a product's measurements,
// or loads an uploaded .glb. Front of the frame faces +z, temples run toward -z, +x = wearer's left.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FrameSpec, lensCenterX, lensOutline, offsetOutline, rimThickness } from "./frame-geometry";

export type LensKind = "clear" | "ar" | "bluecut" | "photosun" | "sun";

export const LENS_LOOK: Record<LensKind, { color: string; opacity: number; label: string; sheen?: string }> = {
  clear: { color: "#eef4ff", opacity: 0.1, label: "Clear" },
  ar: { color: "#f4fffb", opacity: 0.05, label: "Anti-reflection", sheen: "#7bffb7" },
  bluecut: { color: "#fff2b8", opacity: 0.18, label: "Bluecut", sheen: "#6ea8ff" },
  photosun: { color: "#39414d", opacity: 0.62, label: "Photosun (outdoors)" },
  sun: { color: "#1b222c", opacity: 0.82, label: "Sun lens" },
};

export type BuiltFrame = {
  group: THREE.Group;
  setLens: (k: LensKind) => void;
  setTempleSpread: (headHalfWidthMm: number) => void;
  dispose: () => void;
};

function makeLensMaterial(k: LensKind) {
  const look = LENS_LOOK[k];
  return new THREE.MeshPhysicalMaterial({
    color: look.color,
    transparent: true,
    opacity: look.opacity,
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    sheen: look.sheen ? 1 : 0,
    sheenColor: new THREE.Color(look.sheen || "#ffffff"),
    envMapIntensity: k === "ar" ? 0.25 : 1.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function toShape(pts: [number, number][], mirror: boolean) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => {
    const px = mirror ? -x : x;
    if (i === 0) s.moveTo(px, y);
    else s.lineTo(px, y);
  });
  s.closePath();
  return s;
}

/** finish "gradient": the front fades from color (top) to accent (bottom); otherwise accent = browline top bar. */
export function buildFrame(spec: FrameSpec, color: string, accentIn?: string | null, lens: LensKind = "clear", finish?: string): BuiltFrame {
  const group = new THREE.Group();
  const fade = finish === "gradient" && accentIn ? accentIn : null;
  const accent = fade ? null : accentIn;
  const metal = spec.material === "Metal" || spec.material === "Titanium";
  const frameMat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: metal ? 0.25 : 0.32,
    metalness: metal ? 0.9 : 0.05,
    clearcoat: metal ? 0.2 : 0.8,
    clearcoatRoughness: 0.2,
    transparent: /c9d6e3/i.test(color),
    opacity: /c9d6e3/i.test(color) ? 0.55 : 1,
  });
  const accentMat = accent ? frameMat.clone() : frameMat;
  if (accent) {
    accentMat.color = new THREE.Color(accent);
    accentMat.metalness = 0.05;
    accentMat.roughness = 0.32;
  }
  const lensMat = makeLensMaterial(lens);
  const disposables: { dispose(): void }[] = [frameMat, lensMat];
  // gradient fronts are painted per vertex, so the colour runs smoothly from top to bottom of each rim
  const fadeMat = fade ? frameMat.clone() : null;
  if (fadeMat) {
    fadeMat.color = new THREE.Color("#ffffff");
    fadeMat.vertexColors = true;
    disposables.push(fadeMat);
  }
  const paintFade = (geo: THREE.BufferGeometry) => {
    const top = new THREE.Color(color), bottom = new THREE.Color(fade!);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < min) min = y; if (y > max) max = y; }
    const cols = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = (max - pos.getY(i)) / Math.max(max - min, 1e-6); // 0 = top, 1 = bottom
      const k = Math.min(1, Math.max(0, (t - 0.2) / 0.65)); // keep the top band solid, fade through the middle
      c.copy(top).lerp(bottom, k);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  };
  if (accent) disposables.push(accentMat);

  const outline = lensOutline(spec, 120);
  const rim = offsetOutline(outline, rimThickness(spec));
  const cx = lensCenterX(spec);
  const depth = metal ? 1.4 : 3.6;

  for (const side of [1, -1]) {
    const mirror = side === -1;
    // rim with the lens cut out
    const shape = toShape(rim, mirror);
    shape.holes.push(toShape([...outline].reverse(), mirror) as unknown as THREE.Path);
    const rimGeo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.45, bevelSegments: 3, curveSegments: 8 });
    rimGeo.translate(0, 0, -depth / 2);
    if (fadeMat) paintFade(rimGeo);
    const rimMesh = new THREE.Mesh(rimGeo, fadeMat || frameMat);
    rimMesh.position.x = side * cx;
    group.add(rimMesh);
    disposables.push(rimGeo);

    // two-tone top bar (browline) — a thicker brow over the upper rim
    if (accent) {
      const topPts = rim.filter(([, y]) => y > spec.lensHeight * 0.05);
      const inner = outline.filter(([, y]) => y > spec.lensHeight * 0.05).reverse();
      const brow = toShape([...topPts, ...inner], mirror);
      const browGeo = new THREE.ExtrudeGeometry(brow, { depth: 4.6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.5, bevelSegments: 2 });
      browGeo.translate(0, 0, -2.3);
      const browMesh = new THREE.Mesh(browGeo, accentMat);
      browMesh.position.x = side * cx;
      browMesh.position.z = 0.4;
      group.add(browMesh);
      disposables.push(browGeo);
    }

    // lens: gently curved (base curve) so reflections read as glass
    const lensGeo = new THREE.ShapeGeometry(toShape(outline, mirror), 24);
    const pos = lensGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, -(x * x + y * y) / (2 * 120)); // ~base 4 curve
    }
    lensGeo.computeVertexNormals();
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.position.set(side * cx, 0, 0.6);
    lensMesh.renderOrder = 3;
    lensMesh.name = "lens";
    group.add(lensMesh);
    disposables.push(lensGeo);

    // end piece / hinge block at the outer rim
    const outerX = Math.max(...rim.map(([x]) => x));
    const hingeY = spec.lensHeight * 0.28;
    const hingeGeo = new THREE.BoxGeometry(metal ? 2 : 4, metal ? 2.4 : 5.5, metal ? 3 : 7);
    const hinge = new THREE.Mesh(hingeGeo, accent ? accentMat : frameMat);
    hinge.position.set(side * (cx + outerX + (metal ? 0.6 : 1)), hingeY, -2.5);
    group.add(hinge);
    disposables.push(hingeGeo);

    // nose pads for metal frames
    if (metal) {
      const padGeo = new THREE.SphereGeometry(2.6, 16, 12);
      padGeo.scale(0.55, 1, 0.8);
      const padMat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, roughness: 0.2 });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(side * (spec.bridge / 2 + 1.5), -spec.lensHeight * 0.12, -7);
      group.add(pad);
      disposables.push(padGeo, padMat);
    }
  }

  // bridge
  const innerTop = spec.lensHeight * 0.12;
  const bx = spec.bridge / 2 + 1.5;
  const bridgeCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-bx, innerTop, 0), new THREE.Vector3(0, innerTop + (metal ? 5 : 3.5), 1.2), new THREE.Vector3(bx, innerTop, 0));
  const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 24, metal ? 0.9 : 2.1, 10, false);
  group.add(new THREE.Mesh(bridgeGeo, accent ? accentMat : frameMat));
  disposables.push(bridgeGeo);
  if (metal) {
    const topBar = new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(new THREE.Vector3(-bx - 1, spec.lensHeight * 0.42, 0), new THREE.Vector3(0, spec.lensHeight * 0.46, 1), new THREE.Vector3(bx + 1, spec.lensHeight * 0.42, 0)),
      20, 0.7, 8, false,
    );
    group.add(new THREE.Mesh(topBar, frameMat));
    disposables.push(topBar);
  }

  // temples — rebuilt when the head width is known so they sit just outside the head
  const templeGroup = new THREE.Group();
  templeGroup.name = "temples";
  group.add(templeGroup);
  const templeShape = new THREE.Shape();
  const tw = metal ? 1.1 : 1.6, th = metal ? 1.6 : 4.2;
  templeShape.moveTo(-tw, -th);
  templeShape.lineTo(tw, -th);
  templeShape.lineTo(tw, th);
  templeShape.lineTo(-tw, th);
  templeShape.closePath();
  const outerRimX = cx + Math.max(...rim.map(([x]) => x)) + (metal ? 0.6 : 1);
  let templeGeos: THREE.BufferGeometry[] = [];

  const setTempleSpread = (headHalf: number) => {
    templeGeos.forEach((g) => g.dispose());
    templeGeos = [];
    templeGroup.clear();
    const L = spec.templeLength;
    const back = Math.max(outerRimX, headHalf + 2.5);
    for (const side of [1, -1]) {
      const y0 = spec.lensHeight * 0.28;
      const pts = [
        new THREE.Vector3(side * outerRimX, y0, -3),
        new THREE.Vector3(side * (outerRimX + (back - outerRimX) * 0.35), y0, -L * 0.25),
        new THREE.Vector3(side * back, y0 - 2, -L * 0.55),
        new THREE.Vector3(side * back, y0 - 5, -L * 0.72),
        new THREE.Vector3(side * (back - 3), y0 - 18, -L * 0.9),
        new THREE.Vector3(side * (back - 6), y0 - 32, -L * 0.98),
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.ExtrudeGeometry(templeShape, { steps: 60, bevelEnabled: false, extrudePath: curve });
      templeGeos.push(geo);
      const m = new THREE.Mesh(geo, accent ? accentMat : frameMat);
      m.name = "temple";
      templeGroup.add(m);
    }
  };
  setTempleSpread(spec.frameWidth / 2 - 4);

  return {
    group,
    setLens: (k) => {
      const look = LENS_LOOK[k];
      lensMat.color.set(look.color);
      lensMat.opacity = look.opacity;
      lensMat.sheen = look.sheen ? 1 : 0;
      lensMat.sheenColor.set(look.sheen || "#ffffff");
      lensMat.envMapIntensity = k === "ar" ? 0.25 : 1.1;
      lensMat.needsUpdate = true;
    },
    setTempleSpread,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      templeGeos.forEach((g) => g.dispose());
    },
  };
}

/** Loads an uploaded glTF-binary model and normalises it to the product's frame width (mm). */
export async function loadGlbFrame(url: string, spec: FrameSpec, lens: LensKind): Promise<BuiltFrame> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = spec.frameWidth / Math.max(size.x, 1e-6);
  root.scale.setScalar(scale);
  const b2 = new THREE.Box3().setFromObject(root);
  const c = b2.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -c.y, -b2.max.z + 1);
  const group = new THREE.Group();
  group.add(root);
  const lensMats: THREE.MeshPhysicalMaterial[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && /lens|glass/i.test(m.name + (Array.isArray(m.material) ? "" : m.material?.name || ""))) {
      const mat = makeLensMaterial(lens);
      m.material = mat;
      m.renderOrder = 3;
      lensMats.push(mat);
    }
  });
  return {
    group,
    setLens: (k) =>
      lensMats.forEach((mat) => {
        const look = LENS_LOOK[k];
        mat.color.set(look.color);
        mat.opacity = look.opacity;
      }),
    setTempleSpread: () => {},
    dispose: () =>
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      }),
  };
}

/**
 * Photo try-on: the product's front photo (background already removed) on a flat plane that is exactly
 * as wide as the real frame, so it follows the head like the 3D frame and shows the true size.
 * The plane is centred slightly below the pupils (the eye line sits ~45% down from the top of most fronts).
 */
export async function buildPhotoFrame(url: string, spec: FrameSpec): Promise<BuiltFrame> {
  const tex = await new THREE.TextureLoader().loadAsync(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const img = tex.image as { width: number; height: number };
  const w = spec.frameWidth;
  const h = (w * img.height) / Math.max(img.width, 1);
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const plane = new THREE.Mesh(geo, mat);
  plane.name = "photo";
  plane.position.y = -h * 0.05;
  plane.renderOrder = 4;
  const group = new THREE.Group();
  group.add(plane);
  return {
    group,
    setLens: () => {},
    setTempleSpread: () => {},
    dispose: () => {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}
