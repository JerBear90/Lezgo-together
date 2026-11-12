"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsType } from "three/examples/jsm/controls/OrbitControls.js";
import { buildScene } from "@/lib/build-model";
import { footprint, plateLayers } from "@/lib/catalog";
import { displayBricks, layoutScene } from "@/lib/iso";
import { brickPaint } from "@/lib/parts";
import type { BuildStep } from "@/lib/types";
import { UnsureBadge } from "./ui";

const PLATE = 0.32;

export function StepDiagram({
  steps,
  stepId,
  onShift,
  onSelect,
}: {
  steps: BuildStep[];
  stepId: string;
  onShift: (partId: string, poseIndex: number, axis: "x" | "y", delta: number) => void;
  onSelect: (partId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; partId: string; poseIndex: number } | null>(null);
  const viewScale = useRef(1);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const zoomRef = useRef<(direction: number) => void>(() => {});
  const resetRef = useRef<() => void>(() => {});
  const scene = buildScene(steps, stepId);
  const signature = scene.bricks
    .map((brick) => [brick.key, brick.x, brick.y, brick.layer, brick.rotation, brick.confident, brick.isNew, brick.color, brick.size].join(":"))
    .join("|");
  const layout = layoutScene(scene);
  const arrows = layout.markers.filter((marker) => !marker.ghost);
  const ghosts = layout.markers.filter((marker) => marker.ghost);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const width = root.clientWidth || 1;
    const height = root.clientHeight || 1;
    for (const marker of layout.markers) {
      moveMarker(root, marker.key, (marker.tipX / 100) * width, (marker.tipY / 100) * height, (marker.tailX / 100) * width, (marker.tailY / 100) * height);
    }
  }, [signature, layout]);

  useEffect(() => {
    const host = hostRef.current;
    const root = rootRef.current;
    if (!host || !root) return;
    const mount = host;
    const panel = root;
    const active = buildScene(steps, stepId);
    let stopped = false;
    let cleanup = () => {};

    void (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        if (stopped) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0xf6f0e6, 1);
        mount.appendChild(renderer.domElement);

        const world = new THREE.Scene();
        const shown = displayBricks(active);
        const bounds = sceneBounds(shown);
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
        const home = { theta: Math.PI / 4, phi: Math.PI / 3, radius: Math.max(bounds.span * 2.2, 8) };
        const aim = new THREE.Vector3(bounds.cx, bounds.cy, bounds.cz);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(aim);
        controls.enableDamping = true;
        controls.enablePan = true;
        controls.screenSpacePanning = true;
        controlsRef.current = controls;

        world.add(new THREE.AmbientLight(0xffffff, 0.9));
        const sun = new THREE.DirectionalLight(0xffffff, 1.05);
        sun.position.set(6, 10, 4);
        world.add(sun);
        const rimLight = new THREE.DirectionalLight(0xf4f7fb, 0.45);
        rimLight.position.set(-7, 3, -6);
        world.add(rimLight);

        const hasDark = shown.some((brick) => brick.confident && brickPaint(brick.color).dark);
        renderer.setClearColor(hasDark ? 0xf4f8fc : 0xf6f0e6, 1);
        panel.style.background = hasDark ? "#f4f8fc" : "#f6f0e6";

        const studGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 16);
        for (const brick of shown) {
          const { w, d } = footprint(brick.size, brick.rotation ?? 0);
          const layers = plateLayers(brick.shape);
          const height = layers * PLATE;
          const paint = brickPaint(brick.color);
          const faded = brick.confident && !brick.isNew;
          const bodyColor = new THREE.Color(brick.confident ? paint.fill : "#c8b79a");
          const studColor = new THREE.Color(paint.stud);
          if (faded) {
            bodyColor.multiplyScalar(paint.dark ? 0.88 : 0.62);
            studColor.multiplyScalar(paint.dark ? 0.9 : 0.62);
          }
          const emissive = new THREE.Color(0x000000);
          if (brick.confident && paint.dark) emissive.copy(bodyColor).multiplyScalar(0.22);
          if (brick.isNew && brick.confident) emissive.add(bodyColor.clone().multiplyScalar(0.18));
          const material = brick.confident
            ? new THREE.MeshLambertMaterial({ color: bodyColor, emissive })
            : new THREE.MeshBasicMaterial({ color: 0xc4922a, wireframe: true });
          const studMaterial = brick.confident
            ? new THREE.MeshLambertMaterial({
                color: studColor,
                emissive: paint.dark ? studColor.clone().multiplyScalar(0.28) : 0x000000,
              })
            : material;
          const bodyWidth = brick.confident ? w * 0.96 : Math.max(w, 2.4);
          const bodyDepth = brick.confident ? d * 0.96 : Math.max(d, 2.4);
          const body = brick.shape === "round"
            ? new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) / 2 - 0.04, Math.min(w, d) / 2 - 0.04, height, 24), material)
            : new THREE.Mesh(new THREE.BoxGeometry(bodyWidth, height, bodyDepth), material);
          body.position.set(
            brick.displayX + w / 2,
            brick.displayLayer * PLATE + height / 2,
            brick.displayY + d / 2,
          );
          world.add(body);
          if (brick.confident && brick.shape !== "tile" && brick.shape !== "slope" && brick.shape !== "round") {
            for (let ix = 0; ix < w; ix += 1) {
              for (let iy = 0; iy < d; iy += 1) {
                const stud = new THREE.Mesh(studGeo, studMaterial);
                stud.position.set(
                  brick.displayX + ix + 0.5,
                  brick.displayLayer * PLATE + height + 0.08,
                  brick.displayY + iy + 0.5,
                );
                world.add(stud);
              }
            }
          }
          if (brick.confident && paint.dark) {
            const rim = new THREE.LineSegments(
              new THREE.EdgesGeometry(body.geometry),
              new THREE.LineBasicMaterial({ color: paint.edge }),
            );
            rim.position.copy(body.position);
            world.add(rim);
          }
          if (brick.confident && brick.isNew) {
            const edges = new THREE.LineSegments(
              new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 1.04, height * 1.05, d * 1.04)),
              new THREE.LineBasicMaterial({ color: 0xc4b5fd }),
            );
            edges.position.copy(body.position);
            world.add(edges);
          }
        }

        function frameCamera() {
          const aspect = Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1);
          const view = bounds.span * 0.72 * viewScale.current;
          camera.left = -view * aspect;
          camera.right = view * aspect;
          camera.top = view;
          camera.bottom = -view;
          camera.updateProjectionMatrix();
        }

        function placeCamera() {
          camera.position.set(
            aim.x + home.radius * Math.sin(home.phi) * Math.sin(home.theta),
            aim.y + home.radius * Math.cos(home.phi),
            aim.z + home.radius * Math.sin(home.phi) * Math.cos(home.theta),
          );
          camera.lookAt(aim);
          controls.target.copy(aim);
          controls.update();
          frameCamera();
        }

        function resize() {
          const width = Math.max(mount.clientWidth, 1);
          const height = Math.max(mount.clientHeight, 1);
          renderer.setSize(width, height, false);
          frameCamera();
        }

        function projectMarkers() {
          const width = mount.clientWidth;
          const height = mount.clientHeight;
          if (width < 2 || height < 2) return;
          for (const brick of shown) {
            const { w, d } = footprint(brick.size, brick.rotation ?? 0);
            const top = (brick.displayLayer + plateLayers(brick.shape)) * PLATE + 0.02;
            const point = new THREE.Vector3(brick.displayX + w / 2, top, brick.displayY + d / 2).project(camera);
            const left = (point.x * 0.5 + 0.5) * width;
            const topPx = (-point.y * 0.5 + 0.5) * height;
            moveMarker(panel, brick.key, left, topPx, left - 92, topPx - 72);
          }
        }

        placeCamera();
        resize();
        let lastTap = 0;
        const onDoubleTap = () => {
          const now = performance.now();
          if (now - lastTap < 280) {
            viewScale.current = 1;
            placeCamera();
          }
          lastTap = now;
        };
        renderer.domElement.addEventListener("pointerup", onDoubleTap);
        const observer = new ResizeObserver(() => {
          resize();
          projectMarkers();
        });
        observer.observe(mount);
        let frame = 0;
        const loop = () => {
          controls.update();
          renderer.render(world, camera);
          projectMarkers();
          if (panel.dataset.mode !== "3d") panel.dataset.mode = "3d";
          frame = window.requestAnimationFrame(loop);
        };
        loop();

        zoomRef.current = (direction: number) => {
          viewScale.current = Math.min(2.4, Math.max(0.45, viewScale.current * (direction > 0 ? 0.85 : 1.18)));
          frameCamera();
        };
        resetRef.current = () => {
          viewScale.current = 1;
          placeCamera();
        };

        cleanup = () => {
          window.cancelAnimationFrame(frame);
          renderer.domElement.removeEventListener("pointerup", onDoubleTap);
          observer.disconnect();
          zoomRef.current = () => {};
          resetRef.current = () => {};
          controls.dispose();
          controlsRef.current = null;
          studGeo.dispose();
          world.traverse((node) => {
            const mesh = node as { geometry?: { dispose: () => void }; material?: { dispose?: () => void } | Array<{ dispose?: () => void }> };
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) mesh.material.forEach((item) => item.dispose?.());
            else mesh.material?.dispose?.();
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        if (root) root.dataset.mode = "flat";
      }
    })();

    return () => {
      stopped = true;
      cleanup();
    };
    // signature already covers the brick positions, colors, and which step is current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div
      ref={rootRef}
      data-testid="step-diagram"
      data-mode="pending"
      className="absolute inset-0 bg-[#f6f0e6]"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {layout.faces.map((item) => (
          <polygon
            key={item.key}
            points={item.points}
            fill={item.fill}
            opacity={item.opacity}
            stroke={item.stroke}
            strokeWidth={0.4}
            strokeDasharray={item.dashed ? "1.2 0.8" : undefined}
          />
        ))}
      </svg>
      <div ref={hostRef} className="absolute inset-0 z-0" style={{ touchAction: "none" }} />
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
        <defs>
          <marker id="lezgo-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#e23d2b" />
          </marker>
        </defs>
        {arrows.map((marker) => (
          <line
            key={marker.key}
            data-testid="placement-arrow"
            data-line={marker.key}
            x1={marker.tailX}
            y1={marker.tailY}
            x2={marker.tipX}
            y2={marker.tipY}
            stroke="#e23d2b"
            strokeWidth={3}
            markerEnd="url(#lezgo-arrow)"
          />
        ))}
      </svg>
      {arrows.map((marker) => (
        <button
          key={marker.key}
          type="button"
          data-testid="placement-target"
          data-marker={marker.key}
          data-pose={marker.poseIndex}
          data-x={marker.modelX ?? ""}
          data-y={marker.modelY ?? ""}
          aria-label={`Move ${marker.label}`}
          className="absolute z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ left: `${marker.tipX}%`, top: `${marker.tipY}%` }}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              partId: marker.partId,
              poseIndex: marker.poseIndex,
            };
          }}
          onPointerUp={(event) => {
            const start = dragRef.current;
            dragRef.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
              onSelect(start.partId);
              return;
            }
            if (Math.abs(dx) >= Math.abs(dy)) onShift(start.partId, start.poseIndex, "x", dx > 0 ? 1 : -1);
            else onShift(start.partId, start.poseIndex, "y", dy > 0 ? 1 : -1);
          }}
        >
          <span className="h-4 w-4 rounded-full border-2 border-white bg-brick shadow" />
        </button>
      ))}
      {arrows.map((marker) => (
        <span
          key={`${marker.key}-chip`}
          data-chip={marker.key}
          className="pointer-events-none absolute z-10 -translate-x-0 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold"
          style={{ left: `${marker.tailX}%`, top: `${marker.tailY}%` }}
        >
          {marker.label}
        </span>
      ))}
      {ghosts.map((marker) => (
        <div
          key={marker.key}
          data-testid="ghost-part"
          data-marker={marker.key}
          className="absolute z-20 max-w-40 -translate-x-1/2 rounded-2xl bg-unsure-bg px-2 py-1 text-unsure"
          style={{ left: `${marker.tipX}%`, top: `${marker.tipY}%` }}
        >
          <UnsureBadge label={marker.note ?? "Unsure where this part goes."} />
          <p className="mt-1 text-xs">{marker.note}</p>
        </div>
      ))}
      <p className="pointer-events-none absolute left-3 top-3 z-20 text-xs font-semibold text-muted">Drag to turn · pinch to zoom</p>
      <div className="absolute top-8 left-2 z-20 flex gap-1">
        <button type="button" data-zoom="out" aria-label="Zoom out" className="h-11 w-11 rounded-full bg-card text-lg font-semibold shadow" onClick={() => zoomRef.current(-1)}>
          −
        </button>
        <button type="button" data-zoom="in" aria-label="Zoom in" className="h-11 w-11 rounded-full bg-card text-lg font-semibold shadow" onClick={() => zoomRef.current(1)}>
          +
        </button>
        <button type="button" data-zoom="reset" aria-label="Reset view" className="h-11 rounded-full bg-card px-3 text-sm font-semibold shadow" onClick={() => resetRef.current()}>
          Reset
        </button>
      </div>
    </div>
  );
}

function moveMarker(root: HTMLElement, key: string, left: number, top: number, tailLeft: number, tailTop: number) {
  const handle = root.querySelector<HTMLElement>(`[data-marker="${key}"]`);
  const line = root.querySelector<SVGLineElement>(`[data-line="${key}"]`);
  const chip = root.querySelector<HTMLElement>(`[data-chip="${key}"]`);
  if (handle) {
    handle.style.left = `${left}px`;
    handle.style.top = `${top}px`;
  }
  if (chip) {
    chip.style.left = `${tailLeft}px`;
    chip.style.top = `${tailTop}px`;
  }
  if (line) {
    line.setAttribute("x1", String(tailLeft));
    line.setAttribute("y1", String(tailTop));
    line.setAttribute("x2", String(left));
    line.setAttribute("y2", String(top));
  }
}

function sceneBounds(bricks: ReturnType<typeof displayBricks>) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let maxY = 0.4;
  for (const brick of bricks) {
    const { w, d } = footprint(brick.size, brick.rotation ?? 0);
    minX = Math.min(minX, brick.displayX);
    maxX = Math.max(maxX, brick.displayX + w);
    minZ = Math.min(minZ, brick.displayY);
    maxZ = Math.max(maxZ, brick.displayY + d);
    maxY = Math.max(maxY, (brick.displayLayer + plateLayers(brick.shape)) * PLATE);
  }
  if (!Number.isFinite(minX)) return { cx: 0, cy: 0.4, cz: 0, span: 6 };
  return {
    cx: (minX + maxX) / 2,
    cy: maxY / 2,
    cz: (minZ + maxZ) / 2,
    span: Math.max(maxX - minX, maxZ - minZ, maxY, 4),
  };
}
