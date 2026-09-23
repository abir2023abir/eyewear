"use client";
import Link from "next/link";
import { swatchBg } from "@/lib/finish";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { FaceLandmarker as FL } from "@mediapipe/tasks-vision";
import { buildPhotoFrame, BuiltFrame, LensKind, LENS_LOOK } from "@/lib/frame3d";
import { fitVerdict, measure, median, yawAmount, LM, L } from "@/lib/face";
import { FACE_SHAPE_MATCH, FACE_SHAPE_TIPS, FaceShape } from "@/lib/frame-geometry";
import { cap, ProductDTO } from "@/lib/types";
import { usd } from "@/lib/money";
import FrameArt from "./FrameArt";
import Icon from "./Icon";
import { buildAnyFrame, sourceFor } from "@/lib/frame-source";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const FOV = 40;
const DEPTH = 600;

type Snap = { id: string; url: string; blob: Blob; label: string };
type Mode = "idle" | "loading" | "camera" | "photo" | "error";

export default function TryOnStudio({ products, initialSlug, initialVariant }: { products: ProductDTO[]; initialSlug?: string; initialVariant?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const landmarker = useRef<FL | null>(null);
  const three = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; anchor: THREE.Group;
    occluder: THREE.Group; frame: BuiltFrame | null; env: THREE.Texture;
  } | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const lastVideoTime = useRef(-1);
  const samples = useRef<{ w: number[]; pd: number[]; shape: FaceShape[] }>({ w: [], pd: [], shape: [] });
  const smooth = useRef<{ pos: THREE.Vector3; quat: THREE.Quaternion; scale: number; seen: number } | null>(null);
  const lastLm = useRef<{ lm: LM[]; matrix: number[] } | null>(null);

  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState("");
  const [aspect, setAspect] = useState(4 / 3);
  const [faceFound, setFaceFound] = useState(false);
  const initial = products.find((p) => p.slug === initialSlug) || products[0];
  const [productId, setProductId] = useState(initial?.id);
  const product = products.find((p) => p.id === productId) || products[0];
  const [variantId, setVariantId] = useState(initialVariant && initial?.variants.some((v) => v.id === initialVariant) ? initialVariant : initial?.variants[0]?.id);
  const variant = product.variants.find((v) => v.id === variantId) || product.variants[0];
  const [lens, setLens] = useState<LensKind>(product.category === "sunglasses" ? "sun" : "clear");
  const [metrics, setMetrics] = useState<{ faceWidthMm: number; pdMm: number; faceShape: FaceShape } | null>(null);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [q, setQ] = useState("");
  const [pdSaved, setPdSaved] = useState(false);
  // "photo" = the real product photo on the face; "3d" = the 3D frame. Photo needs a try-on photo for this colour.
  const [look, setLook] = useState<"photo" | "3d">("photo");
  const usePhoto = look === "photo" && !!variant?.tryOnImage;
  const [nudge, setNudge] = useState({ y: 0, s: 1 });
  const nudgeRef = useRef(nudge);
  nudgeRef.current = nudge;

  /* ---------------- three.js setup ---------------- */
  useEffect(() => {
    const host = canvasHost.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      setMode("error");
      setError("3D isn’t available in this browser (WebGL is turned off or unsupported). Try Chrome, Safari or Edge, or update your browser.");
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = "absolute inset-0 w-full h-full";
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = env;
    scene.add(new THREE.HemisphereLight("#ffffff", "#8899bb", 1.1));
    const key = new THREE.DirectionalLight("#ffffff", 1.2);
    key.position.set(0, 200, 600);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(FOV, 4 / 3, 1, 5000);
    const anchor = new THREE.Group();
    anchor.visible = false;
    scene.add(anchor);
    // Invisible head + ears: write depth only, so temple arms disappear behind the head and ears.
    const occluder = new THREE.Group();
    const occMat = new THREE.MeshBasicMaterial({ colorWrite: false });
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), occMat);
    head.name = "head";
    const earGeo = new THREE.BoxGeometry(12, 58, 34);
    const earR = new THREE.Mesh(earGeo, occMat);
    const earL = new THREE.Mesh(earGeo, occMat);
    earR.name = "earR";
    earL.name = "earL";
    occluder.add(head, earR, earL);
    occluder.children.forEach((c) => (c.renderOrder = -1));
    anchor.add(occluder);
    three.current = { renderer, scene, camera, anchor, occluder, frame: null, env };
    sizeOccluder(140);

    const ro = new ResizeObserver(() => resize());
    ro.observe(host);
    resize();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
      three.current?.frame?.dispose();
      env.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      three.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resize = () => {
    const t = three.current;
    const host = canvasHost.current;
    if (!t || !host) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    t.renderer.setSize(w, h, false);
    t.camera.aspect = w / h;
    t.camera.updateProjectionMatrix();
    t.renderer.render(t.scene, t.camera);
  };

  const sizeOccluder = (faceWidthMm: number) => {
    const t = three.current;
    if (!t) return;
    const half = faceWidthMm / 2;
    const head = t.occluder.getObjectByName("head")!;
    head.scale.set(half * 0.97, 118, 97);
    head.position.set(0, 12, -100);
    t.occluder.getObjectByName("earR")!.position.set(-(half + 1), -10, -96);
    t.occluder.getObjectByName("earL")!.position.set(half + 1, -10, -96);
    t.frame?.setTempleSpread(half * 0.97);
  };

  /* ---------------- swap frames ---------------- */
  useEffect(() => {
    const t = three.current;
    if (!t || !variant) return;
    let cancelled = false;
    const spec = product;
    const put = (f: BuiltFrame) => {
      if (cancelled) return f.dispose();
      if (t.frame) {
        t.anchor.remove(t.frame.group);
        t.frame.dispose();
      }
      t.frame = f;
      f.group.position.set(0, -2 + nudgeRef.current.y, 12); // lens plane ~12 mm in front of the eyes, pupils just above centre
      f.group.scale.setScalar(nudgeRef.current.s);
      t.anchor.add(f.group);
      const w = median(samples.current.w);
      f.setTempleSpread((w || 140) / 2 * 0.97);
      renderStill();
    };
    const lk = product.category === "sunglasses" && lens !== "sun" && lens !== "photosun" ? lens : lens;
    if (usePhoto) buildPhotoFrame(variant.tryOnImage!, spec).then(put).catch(() => buildAnyFrame(sourceFor(product, variant), spec, lk).then(put));
    else buildAnyFrame(sourceFor(product, variant), spec, lk).then(put);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, variant?.id, usePhoto]);

  // manual fine-tuning (photo mode): move up/down in mm, and size
  useEffect(() => {
    const fr = three.current?.frame;
    if (!fr) return;
    fr.group.position.y = -2 + nudge.y;
    fr.group.scale.setScalar(nudge.s);
    renderStill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge]);
  useEffect(() => setNudge({ y: 0, s: 1 }), [product.id, variant?.id, usePhoto]);

  useEffect(() => {
    three.current?.frame?.setLens(lens);
    renderStill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens]);

  useEffect(() => {
    setLens(product.category === "sunglasses" ? "sun" : "clear");
  }, [product.category]);

  /* ---------------- landmarker ---------------- */
  const getLandmarker = useCallback(async (runningMode: "VIDEO" | "IMAGE") => {
    if (!landmarker.current) {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(WASM);
      const make = (delegate: "GPU" | "CPU") =>
        FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode,
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false,
        });
      landmarker.current = await make("GPU").catch(() => make("CPU"));
    } else {
      await landmarker.current.setOptions({ runningMode });
    }
    return landmarker.current;
  }, []);

  /* ---------------- pose → anchor ---------------- */
  const applyPose = (lm: LM[], matrix: number[], srcW: number, srcH: number, instant: boolean) => {
    const t = three.current;
    if (!t) return;
    lastLm.current = { lm, matrix };
    const worldH = 2 * DEPTH * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const worldW = worldH * (srcW / srcH);
    const faceMm = median(samples.current.w) || 140;
    const facePx = Math.hypot((lm[L.cheekR].x - lm[L.cheekL].x) * srcW, (lm[L.cheekR].y - lm[L.cheekL].y) * srcH, (lm[L.cheekR].z - lm[L.cheekL].z) * srcW);
    const worldPerMm = (facePx / faceMm) * (worldH / srcH);
    const mid = { x: (lm[L.irisR].x + lm[L.irisL].x) / 2, y: (lm[L.irisR].y + lm[L.irisL].y) / 2 };
    const pos = new THREE.Vector3((mid.x - 0.5) * worldW, -(mid.y - 0.5) * worldH, -DEPTH);
    const quat = new THREE.Quaternion();
    new THREE.Matrix4().fromArray(matrix).decompose(new THREE.Vector3(), quat, new THREE.Vector3());

    const s = smooth.current;
    if (!s || instant) smooth.current = { pos, quat, scale: worldPerMm, seen: performance.now() };
    else {
      // adaptive smoothing: follow fast moves, damp jitter when still
      const moved = s.pos.distanceTo(pos) / (worldPerMm * 10);
      const a = THREE.MathUtils.clamp(0.35 + moved, 0.35, 0.9);
      s.pos.lerp(pos, a);
      s.quat.slerp(quat, a);
      s.scale += (worldPerMm - s.scale) * 0.25;
      s.seen = performance.now();
    }
    const cur = smooth.current!;
    t.anchor.position.copy(cur.pos);
    t.anchor.quaternion.copy(cur.quat);
    t.anchor.scale.setScalar(cur.scale);
    t.anchor.visible = true;
  };

  const collect = (lm: LM[], w: number, h: number) => {
    if (yawAmount(lm) > 0.12) return; // only measure when facing the camera
    const m = measure(lm, w, h);
    if (!m || m.faceWidthMm < 100 || m.faceWidthMm > 190) return;
    const s = samples.current;
    s.w.push(m.faceWidthMm);
    s.pd.push(m.pdMm);
    s.shape.push(m.faceShape);
    if (s.w.length > 90) (s.w.shift(), s.pd.shift(), s.shape.shift());
    if (s.w.length % 10 === 0 || s.w.length === 5) {
      const counts = new Map<FaceShape, number>();
      s.shape.forEach((f) => counts.set(f, (counts.get(f) || 0) + 1));
      const shape = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const fw = median(s.w);
      setMetrics({ faceWidthMm: fw, pdMm: median(s.pd), faceShape: shape });
      sizeOccluder(fw);
    }
  };

  const renderStill = () => {
    const t = three.current;
    if (t) t.renderer.render(t.scene, t.camera);
  };

  /* ---------------- camera mode ---------------- */
  const startCamera = async () => {
    setError("");
    setMode("loading");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera is not available in this browser. Try uploading a selfie instead.");
      const [lmk, media] = await Promise.all([
        getLandmarker("VIDEO"),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false }),
      ]);
      stream.current = media;
      const video = videoRef.current!;
      video.srcObject = media;
      await video.play();
      setAspect(video.videoWidth / video.videoHeight);
      samples.current = { w: [], pd: [], shape: [] };
      smooth.current = null;
      setMode("camera");
      const loop = () => {
        raf.current = requestAnimationFrame(loop);
        const t = three.current;
        if (!t || video.readyState < 2) return;
        if (video.currentTime !== lastVideoTime.current) {
          lastVideoTime.current = video.currentTime;
          const res = lmk.detectForVideo(video, performance.now());
          const lm = res.faceLandmarks?.[0] as LM[] | undefined;
          const mx = res.facialTransformationMatrixes?.[0]?.data as number[] | undefined;
          if (lm && mx) {
            collect(lm, video.videoWidth, video.videoHeight);
            applyPose(lm, Array.from(mx), video.videoWidth, video.videoHeight, false);
            setFaceFound(true);
          } else if (smooth.current && performance.now() - smooth.current.seen > 350) {
            t.anchor.visible = false;
            setFaceFound(false);
          }
        }
        t.renderer.render(t.scene, t.camera);
      };
      loop();
    } catch (e: any) {
      setMode("error");
      setError(e?.name === "NotAllowedError" ? "Camera permission was blocked. Allow camera access in your browser, or upload a selfie instead." : e?.message || "Could not start the camera.");
    }
  };

  const stopCamera = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };
  useEffect(() => () => stopCamera(), []);

  /* ---------------- photo mode ---------------- */
  const onPhoto = async (file?: File) => {
    if (!file) return;
    stopCamera();
    setError("");
    setMode("loading");
    try {
      const url = URL.createObjectURL(file); // stays in memory on this device only
      const img = imgRef.current!;
      img.src = url;
      await img.decode();
      setAspect(img.naturalWidth / img.naturalHeight);
      const lmk = await getLandmarker("IMAGE");
      const res = lmk.detect(img);
      const lm = res.faceLandmarks?.[0] as LM[] | undefined;
      const mx = res.facialTransformationMatrixes?.[0]?.data as number[] | undefined;
      setMode("photo");
      if (!lm || !mx) {
        setFaceFound(false);
        setError("We couldn’t find a face in that photo. Use a well-lit, front-facing selfie.");
        return;
      }
      samples.current = { w: [], pd: [], shape: [] };
      for (let i = 0; i < 10; i++) collect(lm, img.naturalWidth, img.naturalHeight);
      if (!samples.current.w.length) {
        const m = measure(lm, img.naturalWidth, img.naturalHeight);
        if (m) {
          samples.current.w.push(m.faceWidthMm);
          setMetrics({ faceWidthMm: m.faceWidthMm, pdMm: m.pdMm, faceShape: m.faceShape });
          sizeOccluder(m.faceWidthMm);
        }
      }
      smooth.current = null;
      requestAnimationFrame(() => {
        resize();
        applyPose(lm, Array.from(mx), img.naturalWidth, img.naturalHeight, true);
        setFaceFound(true);
        renderStill();
      });
    } catch (e: any) {
      setMode("error");
      setError(e?.message || "Could not read that photo.");
    }
  };

  // re-render a still photo whenever the frame changes
  useEffect(() => {
    if (mode !== "photo" || !lastLm.current || !imgRef.current) return;
    const id = setTimeout(() => {
      const img = imgRef.current!;
      applyPose(lastLm.current!.lm, lastLm.current!.matrix, img.naturalWidth, img.naturalHeight, true);
      renderStill();
    }, 30);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant?.id, lens, mode, aspect, usePhoto, nudge]);

  useEffect(() => {
    requestAnimationFrame(resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  /* ---------------- snapshots / share ---------------- */
  const snapshot = async () => {
    const t = three.current;
    const src = mode === "camera" ? videoRef.current : imgRef.current;
    if (!t || !src) return;
    const w = mode === "camera" ? videoRef.current!.videoWidth : imgRef.current!.naturalWidth;
    const h = mode === "camera" ? videoRef.current!.videoHeight : imgRef.current!.naturalHeight;
    const scale = Math.min(1, 1280 / w);
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext("2d")!;
    t.renderer.render(t.scene, t.camera);
    ctx.save();
    if (mode === "camera") {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(src, 0, 0, c.width, c.height);
    ctx.drawImage(t.renderer.domElement, 0, 0, c.width, c.height);
    ctx.restore();
    const label = `${product.name} ${product.modelCode} · ${variant.colorName}`;
    ctx.fillStyle = "rgba(10,36,99,.78)";
    ctx.fillRect(0, c.height - 44, c.width, 44);
    ctx.fillStyle = "#fff";
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.fillText(label, 16, c.height - 16);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
    setSnaps((s) => [{ id: crypto.randomUUID(), url: URL.createObjectURL(blob), blob, label }, ...s].slice(0, 12));
  };

  const share = async (s: Snap) => {
    const file = new File([s.blob], `try-on-${product.modelCode}.jpg`, { type: "image/jpeg" });
    const url = `${location.origin}/product/${product.slug}?v=${variant.id}`;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: s.label, text: `What do you think of these? ${url}` });
        return;
      } catch {}
    }
    const a = document.createElement("a");
    a.href = s.url;
    a.download = file.name;
    a.click();
  };

  useEffect(() => () => snaps.forEach((s) => URL.revokeObjectURL(s.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- derived ---------------- */
  const fit = metrics ? fitVerdict(product.frameWidth, metrics.faceWidthMm) : null;
  const suggestions = useMemo(() => {
    if (!metrics) return [];
    const good = FACE_SHAPE_MATCH[metrics.faceShape];
    return products
      .filter((p) => good.includes(p.shape as never))
      .map((p) => ({ p, fit: fitVerdict(p.frameWidth, metrics.faceWidthMm) }))
      .sort((a, b) => (a.fit.tone === "ok" ? 0 : a.fit.tone === "warn" ? 1 : 2) - (b.fit.tone === "ok" ? 0 : b.fit.tone === "warn" ? 1 : 2))
      .slice(0, 6);
  }, [metrics, products]);
  const list = products.filter((p) => !q || `${p.name} ${p.modelCode} ${p.shape} ${p.material}`.toLowerCase().includes(q.toLowerCase()));
  const pick = (p: ProductDTO, vId?: string) => {
    setProductId(p.id);
    setVariantId(vId || p.variants[0].id);
  };
  const mirrored = mode === "camera";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6">
      {/* ---------------- stage ---------------- */}
      <div className="min-w-0">
        <div ref={stageRef} className="relative w-full rounded-[26px] overflow-hidden bg-[#0b1b3f] shadow-[var(--shadow-lg)]" style={{ aspectRatio: String(aspect), minWidth: 0, minHeight: mode === "camera" || mode === "photo" ? undefined : 470 }}>
          <video ref={videoRef} playsInline muted className={`absolute inset-0 w-full h-full object-cover ${mode === "camera" ? "" : "hidden"}`} style={{ transform: mirrored ? "scaleX(-1)" : undefined }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} alt="Your selfie" className={`absolute inset-0 w-full h-full object-cover ${mode === "photo" ? "" : "hidden"}`} />
          <div ref={canvasHost} className="absolute inset-0" style={{ transform: mirrored ? "scaleX(-1)" : undefined }} />

          {(mode === "idle" || mode === "error" || mode === "loading") && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-white" style={{ background: "radial-gradient(circle at 50% 30%, #1d4fb8, #0a2463 70%)" }}>
              <div className="max-w-md">
                <div className="w-44 mx-auto opacity-95"><FrameArt spec={product} color="#ffffff" className="w-full" /></div>
                <h2 className="font-display text-3xl font-semibold mt-3">{mode === "loading" ? "Starting the fitting room…" : "Virtual try-on studio"}</h2>
                <p className="text-[#c7d8f7] mt-2 text-sm">Frames lock onto your face automatically — no dragging or resizing. Everything runs on your device; nothing is uploaded or stored.</p>
                {error && <p className="mt-3 text-sm bg-white/10 rounded-xl p-3 text-[#ffd7d7]">{error}</p>}
                {mode !== "loading" ? (
                  <div className="flex flex-wrap justify-center gap-3 mt-6">
                    <button onClick={startCamera} className="btn bg-white text-[var(--navy)] btn-lg"><Icon name="camera" /> Use my camera</button>
                    <label className="btn border border-white/40 text-white btn-lg cursor-pointer">
                      <Icon name="upload" /> Upload a selfie
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
                    </label>
                  </div>
                ) : (
                  <div className="mt-6 mx-auto w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
                )}
              </div>
            </div>
          )}

          {(mode === "camera" || mode === "photo") && (
            <>
              {!faceFound && mode === "camera" && (
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="w-[38%] aspect-[3/4] rounded-[50%] border-4 border-dashed border-white/60" />
                  <div className="absolute bottom-20 chip">Centre your face in the oval</div>
                </div>
              )}
              {fit && faceFound && (
                <div className={`absolute top-4 left-4 flex items-center gap-2 rounded-full px-4 py-2 font-bold text-sm text-white shadow-lg ${fit.tone === "ok" ? "bg-[var(--ok)]" : fit.tone === "warn" ? "bg-[var(--warn)]" : "bg-[var(--bad)]"}`}>
                  <Icon name={fit.tone === "ok" ? "check" : "ruler"} size={16} /> {fit.label}
                </div>
              )}
              <div className="absolute top-4 right-4 chip !bg-black/40 !text-white !border-white/20"><Icon name="shield" size={14} /> On-device only</div>
              {usePhoto && faceFound && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 grid gap-1.5" aria-label="Adjust the frame">
                  {([
                    ["▲", "Move up", () => setNudge((n) => ({ ...n, y: Math.min(12, n.y + 1) }))],
                    ["▼", "Move down", () => setNudge((n) => ({ ...n, y: Math.max(-12, n.y - 1) }))],
                    ["+", "Bigger", () => setNudge((n) => ({ ...n, s: Math.min(1.25, +(n.s + 0.02).toFixed(2)) }))],
                    ["−", "Smaller", () => setNudge((n) => ({ ...n, s: Math.max(0.8, +(n.s - 0.02).toFixed(2)) }))],
                  ] as const).map(([l, t, fn]) => (
                    <button key={t} onClick={fn} title={t} aria-label={t} className="w-9 h-9 rounded-full bg-black/45 text-white border border-white/30 font-bold text-lg leading-none hover:bg-black/60">{l}</button>
                  ))}
                  {(nudge.y !== 0 || nudge.s !== 1) && <button onClick={() => setNudge({ y: 0, s: 1 })} title="Reset" aria-label="Reset" className="w-9 h-9 rounded-full bg-white/90 text-[var(--navy)] text-[10px] font-bold">Reset</button>}
                </div>
              )}
              <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                <button onClick={snapshot} className="btn bg-white text-[var(--navy)] shadow-lg" disabled={!faceFound}><Icon name="camera" size={16} /> Snapshot</button>
                {mode === "camera" ? (
                  <label className="btn bg-black/40 text-white border border-white/30 cursor-pointer">
                    <Icon name="upload" size={16} /> Use a photo
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
                  </label>
                ) : (
                  <button onClick={startCamera} className="btn bg-black/40 text-white border border-white/30"><Icon name="camera" size={16} /> Live camera</button>
                )}
              </div>
            </>
          )}
        </div>

        {/* photo / 3D switch */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-1" role="radiogroup" aria-label="Try-on view">
            {([["photo", "Real photo"], ["3d", "3D model"]] as const).map(([k, l]) => (
              <button
                key={k}
                role="radio"
                aria-checked={(k === "photo") === usePhoto}
                disabled={k === "photo" && !variant?.tryOnImage}
                onClick={() => setLook(k)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${(k === "photo") === usePhoto ? "bg-[var(--navy)] text-white" : "text-[var(--ink)] disabled:opacity-40"}`}
              >
                {k === "3d" && <Icon name="cube" size={14} className="inline -mt-0.5 mr-1" />}{l}
              </button>
            ))}
          </div>
          <span className="text-xs muted">
            {usePhoto
              ? "The real product photo, shown at true size. Use ▲ ▼ + − on the picture to fine-tune."
              : product.modelUrl || variant?.modelUrl
                ? "The real 3D model of this frame — turn your head to see it from any angle."
                : variant?.tryOnImage
                  ? "3D built from the product photo: the real shape and colours, and the arms go behind your ears."
                  : "3D frame built from this model’s measurements."}
          </span>
        </div>

        {/* lens previews (3D only) */}
        <div className={`flex flex-wrap items-center gap-2 mt-3 ${usePhoto ? "hidden" : ""}`}>
          <span className="text-sm font-bold mr-1">Lens preview:</span>
          {(product.category === "sunglasses" ? (["sun", "photosun", "bluecut", "clear"] as LensKind[]) : (["clear", "ar", "bluecut", "photosun"] as LensKind[])).map((k) => (
            <button key={k} onClick={() => setLens(k)} className={`chip ${lens === k ? "!bg-[var(--navy)] !text-white !border-[var(--navy)]" : ""}`}>
              <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ background: LENS_LOOK[k].color }} /> {LENS_LOOK[k].label}
            </button>
          ))}
        </div>

        {/* snapshots */}
        {snaps.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xl font-semibold text-[var(--navy)]">Your snapshots</h3>
              <button className="btn btn-outline btn-sm" disabled={compare.length !== 2} onClick={() => setShowCompare(true)}>
                Compare selected ({compare.length}/2)
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {snaps.map((s) => (
                <div key={s.id} className={`rounded-2xl overflow-hidden border-2 ${compare.includes(s.id) ? "border-[var(--blue)]" : "border-transparent"} bg-white shadow`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt={s.label} className="w-full aspect-[4/3] object-cover" />
                  <div className="p-2 flex gap-1.5">
                    <button className="btn btn-sm btn-outline flex-1 !px-2" onClick={() => setCompare((c) => (c.includes(s.id) ? c.filter((x) => x !== s.id) : [...c, s.id].slice(-2)))}>
                      {compare.includes(s.id) ? "Selected" : "Compare"}
                    </button>
                    <button className="btn btn-sm btn-blue !px-3" onClick={() => share(s)} aria-label="Share"><Icon name="share" size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs muted mt-2">Snapshots stay on this device until you share or download them.</p>
          </div>
        )}
      </div>

      {/* ---------------- side panel ---------------- */}
      <aside className="grid gap-4 content-start">
        <div className="card p-5">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="text-xs muted font-bold uppercase tracking-wider">Trying on</div>
              <div className="font-display text-2xl font-semibold text-[var(--navy)]">{product.name} <span className="code-pill align-middle">{product.modelCode}</span></div>
              <div className="text-sm muted">{cap(product.shape)} · {product.material} · {product.frameWidth} mm wide</div>
            </div>
            <div className="text-right font-extrabold">{usd(product.price)}</div>
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {product.variants.map((v) => (
              <button key={v.id} title={v.colorName} aria-label={v.colorName} onClick={() => setVariantId(v.id)} className={`swatch ${v.id === variant.id ? "on" : ""}`} style={{ background: swatchBg(v) }} />
            ))}
          </div>
          <div className="text-sm mt-2">Colour: <b>{variant.colorName}</b></div>
          <Link href={`/product/${product.slug}?v=${variant.id}`} className="btn btn-primary w-full mt-4">Choose lenses & buy <Icon name="arrow" size={15} /></Link>
        </div>

        <div className="card p-5">
          <div className="font-bold flex items-center gap-2"><Icon name="ruler" size={16} className="text-[var(--blue)]" /> Your fit</div>
          {metrics ? (
            <div className="grid gap-2 mt-3 text-sm">
              <div className="flex justify-between"><span className="muted">Face width</span><b>{Math.round(metrics.faceWidthMm)} mm</b></div>
              <div className="flex justify-between"><span className="muted">This frame</span><b>{product.frameWidth} mm</b></div>
              {fit && <div className={`tag ${fit.tone === "ok" ? "tag-ok" : fit.tone === "warn" ? "tag-warn" : "tag-bad"} !normal-case !tracking-normal !text-[13px] !py-1.5 text-center`}>{fit.label} — {fit.detail}</div>}
              <div className="flex justify-between items-center mt-1">
                <span className="muted">Estimated PD</span>
                <span className="flex items-center gap-2">
                  <b>{metrics.pdMm.toFixed(1)} mm</b>
                  <button
                    className="text-[var(--blue)] text-xs font-bold"
                    onClick={() => {
                      try { sessionStorage.setItem("tryon-pd", metrics.pdMm.toFixed(1)); } catch {}
                      setPdSaved(true);
                    }}
                  >
                    {pdSaved ? "Saved for checkout ✓" : "Use for my order"}
                  </button>
                </span>
              </div>
              <p className="text-xs muted">Estimates from your camera (±2 mm). For prescription lenses, your optician’s PD is best.</p>
            </div>
          ) : (
            <p className="text-sm muted mt-2">Start the camera or upload a selfie — we’ll measure your face width and PD automatically.</p>
          )}
        </div>

        {metrics && (
          <div className="card p-5">
            <div className="font-bold">Face shape: <span className="text-[var(--blue)]">{cap(metrics.faceShape)}</span></div>
            <p className="text-sm muted mt-1">{FACE_SHAPE_TIPS[metrics.faceShape]}</p>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {suggestions.map(({ p, fit: f }) => (
                <button key={p.id} onClick={() => pick(p)} className={`rounded-xl border p-2 text-left hover:border-[var(--blue)] ${p.id === product.id ? "border-[var(--blue)] bg-[var(--sky-2)]" : "border-[var(--line)]"}`}>
                  <FrameArt photo={p.variants[0].images[0]} spec={p} color={p.variants[0].colorHex} accent={p.variants[0].accentHex} finish={p.variants[0].finish} className="w-full" />
                  <div className="text-[12px] font-bold truncate">{p.name}</div>
                  {f.tone === "ok" && <div className="text-[10px] font-bold text-[var(--ok)]">Fits you</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="card p-5">
          <div className="font-bold mb-2">All frames</div>
          <input className="input !py-2" placeholder="Search frames…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid grid-cols-3 gap-2 mt-3 max-h-[360px] overflow-y-auto pr-1">
            {list.map((p) => {
              const f = metrics ? fitVerdict(p.frameWidth, metrics.faceWidthMm) : null;
              return (
                <button key={p.id} onClick={() => pick(p)} className={`rounded-xl border p-2 text-left hover:border-[var(--blue)] ${p.id === product.id ? "border-[var(--blue)] bg-[var(--sky-2)]" : "border-[var(--line)]"}`}>
                  <FrameArt photo={p.variants[0].images[0]} spec={p} color={p.variants[0].colorHex} accent={p.variants[0].accentHex} finish={p.variants[0].finish} sun={p.category === "sunglasses"} className="w-full" />
                  <div className="text-[12px] font-bold truncate">{p.name} {p.modelCode}</div>
                  {f?.tone === "ok" && <div className="text-[10px] font-bold text-[var(--ok)]">Fits you</div>}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ---------------- compare modal ---------------- */}
      {showCompare && (
        <div className="fixed inset-0 z-[80] bg-[rgba(11,27,63,.8)] grid place-items-center p-4" onClick={() => setShowCompare(false)}>
          <div className="bg-white rounded-3xl p-5 w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-2xl font-semibold text-[var(--navy)]">Side by side</h3>
              <button className="icon-btn" onClick={() => setShowCompare(false)} aria-label="Close"><Icon name="x" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {compare.map((id) => snaps.find((s) => s.id === id)).filter(Boolean).map((s) => (
                <figure key={s!.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s!.url} alt={s!.label} className="w-full rounded-2xl" />
                  <figcaption className="flex justify-between items-center mt-2 text-sm font-bold">
                    {s!.label}
                    <button className="btn btn-sm btn-blue" onClick={() => share(s!)}><Icon name="share" size={14} /> Share</button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
