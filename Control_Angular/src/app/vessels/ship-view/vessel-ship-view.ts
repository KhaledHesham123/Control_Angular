import { AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChildren, signal } from '@angular/core';
import type { Object3D, OrthographicCamera } from 'three';

interface FleetShip {
  name: string;
}

interface ShipDiorama {
  pivot: Object3D;
  sea: Object3D;
  dispose: () => void;
}

interface Viewport {
  destroy: () => void;
}

@Component({
  selector: 'app-vessel-ship-view',
  standalone: false,
  templateUrl: './vessel-ship-view.html',
  styleUrl: './vessel-ship-view.css',
})
export class VesselShipView implements AfterViewInit, OnDestroy {
  @ViewChildren('stage') private stages?: QueryList<ElementRef<HTMLDivElement>>;

  readonly failed = signal(false);
  readonly ships: FleetShip[] = [{ name: 'AMANY QUEEN' }, { name: 'GOLDEN ARROW' }];

  private readonly viewports: Viewport[] = [];
  private destroyed = false;
  private readonly reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  ngAfterViewInit(): void {
    void this.mount();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    for (const viewport of this.viewports) {
      viewport.destroy();
    }
  }

  private async mount(): Promise<void> {
    const stages = this.stages?.toArray() ?? [];
    if (stages.length === 0) {
      return;
    }

    try {
      const [THREE, queen, arrow] = await Promise.all([
        import('three'),
        import('./cargo-ship'),
        import('./golden-arrow'),
      ]);
      if (this.destroyed) {
        return;
      }
      const builds = [queen.buildAmanyQueen, arrow.buildGoldenArrow];
      stages.forEach((stage, index) => {
        const build = builds[index];
        if (!build) {
          return;
        }
        this.viewports.push(mountViewport(stage.nativeElement, THREE, build, this.reduceMotion));
      });
    } catch {
      this.failed.set(true);
    }
  }
}

function mountViewport(
  stage: HTMLElement,
  THREE: typeof import('three'),
  build: () => ShipDiorama,
  reduceMotion: boolean,
): Viewport {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  if (!renderer.getContext()) {
    renderer.dispose();
    return { destroy: () => undefined };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = null;

  let cameraY = 2.9;
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 120);
  const frameCamera = (): void => {
    const aspect = Math.max(stage.clientWidth / Math.max(stage.clientHeight, 1), 0.35);
    const tanV = Math.tan((26 * Math.PI) / 180 / 2);
    const distance = Math.max(8.4 / (tanV * aspect), 3.4 / tanV);
    camera.position.set(distance * 0.34, cameraY, distance);
    camera.lookAt(0, 0.68, 0);
  };
  frameCamera();

  scene.add(new THREE.HemisphereLight('#e8eef2', '#5e6c72', 0.72));
  const sun = new THREE.DirectionalLight('#f4f7fa', 1.7);
  sun.position.set(5, 10, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  const shadowCamera = sun.shadow.camera as OrthographicCamera;
  shadowCamera.left = -9;
  shadowCamera.right = 9;
  shadowCamera.top = 9;
  shadowCamera.bottom = -9;
  shadowCamera.near = 1;
  shadowCamera.far = 28;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#9aadb6', 0.22);
  fill.position.set(-7, 4, -5);
  scene.add(fill);

  const diorama = build();
    diorama.pivot.rotation.y = -0.62;
  scene.add(diorama.pivot);

  let dragActive = false;
  let lastX = 0;
  let lastY = 0;
  let resumeAt = 0;
  let lastFrame = 0;

  const resize = (): void => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (width < 2 || height < 2) {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    frameCamera();
  };

  const onPointerDown = (event: PointerEvent): void => {
    dragActive = true;
    lastX = event.clientX;
    lastY = event.clientY;
    stage.classList.add('dragging');
    stage.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragActive) {
      return;
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    diorama.pivot.rotation.y += dx * 0.008;
    cameraY = Math.min(7, Math.max(1.3, cameraY - dy * 0.012));
    camera.position.y = cameraY;
    camera.lookAt(0, 0.68, 0);
  };

  const onPointerUp = (): void => {
    dragActive = false;
    resumeAt = performance.now() + 1000;
    stage.classList.remove('dragging');
  };

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);

  const observer = new ResizeObserver(() => resize());
  observer.observe(stage);
  resize();

  const animate = (time: number): void => {
    const delta = Math.min(0.05, lastFrame ? (time - lastFrame) / 1000 : 0);
    lastFrame = time;
    if (!reduceMotion && !dragActive && time > resumeAt) {
      diorama.pivot.rotation.y += delta * ((Math.PI * 2) / 48);
    }
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(animate);

  return {
    destroy: () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      diorama.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
