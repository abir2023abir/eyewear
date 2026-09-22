"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BuiltFrame, LensKind } from "@/lib/frame3d";
import { buildAnyFrame, type FrameSource } from "@/lib/frame-source";
import type { FrameSpec } from "@/lib/frame-geometry";

type Props = { spec: FrameSpec; source: FrameSource; lens?: LensKind };

/** Drag-to-rotate 360° 3D view of a frame. */
export default function Viewer360({ spec, source, lens = "clear" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(true);
  const [failed, setFailed] = useState(false);
  const frameRef = useRef<BuiltFrame | null>(null);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.add(new THREE.HemisphereLight("#ffffff", "#c9d8f5", 1.2));
    const key = new THREE.DirectionalLight("#ffffff", 1.6);
    key.position.set(80, 120, 160);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    camera.position.set(90, 40, 260);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 160;
    controls.maxDistance = 420;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.2;
    controls.enableDamping = true;
    controls.target.set(0, 0, -45);
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      setHint(false);
    });

    let disposed = false;
    const onFrame = (f: BuiltFrame) => {
      if (disposed) return f.dispose();
      frameRef.current = f;
      scene.add(f.group);
      // frame the whole object, whatever its size (a scanned or traced model can be bigger than a built one)
      const sphere = new THREE.Box3().setFromObject(f.group).getBoundingSphere(new THREE.Sphere());
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect || 1, 0.1));
      const dist = (sphere.radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.08;
      controls.target.copy(sphere.center);
      camera.position.set(sphere.center.x + dist * 0.33, sphere.center.y + dist * 0.16, sphere.center.z + dist * 0.93);
      controls.minDistance = dist * 0.55;
      controls.maxDistance = dist * 2;
      controls.update();
    };
    buildAnyFrame(source, spec, lens).then(onFrame);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); // CSS size stays 100% so the canvas can shrink with its box
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      frameRef.current?.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [spec, source.model, source.traced, source.color.color, source.color.accent, source.color.finish, source.tint]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => frameRef.current?.setLens(lens), [lens]);

  return (
    <div ref={host} className="relative w-full h-full cursor-grab active:cursor-grabbing">
      {failed && <div className="absolute inset-0 grid place-items-center text-sm muted p-6 text-center">3D view isn’t supported in this browser — see the Front and Angle views.</div>}
      {hint && !failed && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 chip pointer-events-none">↻ Drag to rotate 360°</div>}
    </div>
  );
}
