import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HullSpec, createShipModel, createSea, disposeShip, resolveHull } from '../core/ship-hull';

type View = 'quarter' | 'side' | 'top' | 'bow' | 'stern';

@Component({
  selector: 'sh-viewer',
  standalone: false,
  template: `
    <div class="hull-view">
      @if (failed()) {
        <div class="hull-fallback">تعذر تشغيل العرض ثلاثي الأبعاد في المتصفح.</div>
      } @else {
        <canvas #cv></canvas>
        <div class="hull-tools">
          <button type="button" class="btn btn-sm" (click)="look('quarter')">منظور</button>
          <button type="button" class="btn btn-sm" (click)="look('side')">جانب</button>
          <button type="button" class="btn btn-sm" (click)="look('top')">سطح</button>
          <button type="button" class="btn btn-sm" (click)="look('bow')">مقدمة</button>
          <button type="button" class="btn btn-sm" (click)="look('stern')">مؤخرة</button>
          <button type="button" class="btn btn-sm" [class.on]="spinning()" (click)="toggleSpin()">دوران</button>
        </div>
        <div class="hull-caption">
          @if (spec().accurate) {
            <b>M/V AMANY QUEEN</b>
            · Sietas Typ 119 · يارد 860
            · الطول 96.97 م · العرض 17.60 م · العمق 8.50 م · الغاطس 6.89 م
            · عنبران · 4 أوناش سارية
          } @else {
            نموذج تقريبي حسب أبعاد {{ name() }}
          }
          <span class="hull-hint">اسحب للتدوير · لما تسيب الماوس تكمل لوحدها · العجلة للتقريب</span>
        </div>
      }
    </div>
  `,
})
export class ShipViewer {
  readonly name = input('');
  readonly imo = input('');
  readonly loa = input<number | null>(null);
  readonly beam = input<number | null>(null);
  readonly draft = input<number | null>(null);

  readonly failed = signal(false);
  readonly spinning = signal(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  readonly spec = computed(() =>
    resolveHull({
      name: this.name(),
      imo: this.imo(),
      loa: this.loa(),
      beam: this.beam(),
      draft: this.draft(),
    }),
  );

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('cv');
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private ship: THREE.Group | null = null;
  private sea: THREE.Mesh | null = null;
  private frame = 0;
  private goal: THREE.Vector3 | null = null;
  private goalTarget: THREE.Vector3 | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      const spec = this.spec();
      if (!canvas || this.failed()) return;
      this.ensure(canvas);
      this.show(spec);
    });
    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  look(view: View): void {
    const camera = this.camera;
    const controls = this.controls;
    const spec = this.spec();
    if (!camera || !controls) return;
    const frame = this.frameOf(view, spec);
    if (this.ship) this.ship.rotation.y = 0;
    camera.up.set(view === 'top' ? 1 : 0, view === 'top' ? 0 : 1, 0);
    controls.autoRotate = false;
    this.goal = frame.position;
    this.goalTarget = frame.target;
  }

  toggleSpin(): void {
    this.spinning.update((on) => !on);
    this.goal = null;
    if (this.controls) this.controls.autoRotate = this.spinning();
  }

  private ensure(canvas: HTMLCanvasElement): void {
    if (this.renderer) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      this.failed.set(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xb7c9d6, 140, 340);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 800);
    this.camera = camera;

    const hemi = new THREE.HemisphereLight(0xf7fbff, 0x6a7c86, 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3df, 1.45);
    sun.position.set(48, 72, 56);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc5d7e6, 0.45);
    fill.position.set(-60, 20, -40);
    scene.add(fill);

    const sea = createSea(0);
    scene.add(sea);
    this.sea = sea;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.7;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 18;
    controls.maxDistance = 240;
    controls.autoRotate = this.spinning();
    controls.autoRotateSpeed = 1.15;
    controls.target.set(0, 6, 0);
    controls.addEventListener('start', () => {
      this.goal = null;
    });
    controls.addEventListener('end', () => {
      controls.autoRotate = this.spinning();
    });
    this.controls = controls;

    const host = canvas.parentElement;
    if (host) {
      this.resize = new ResizeObserver(() => this.resizeTo(canvas));
      this.resize.observe(host);
    }
    this.resizeTo(canvas);
    this.draw();
  }

  private show(spec: HullSpec): void {
    const scene = this.scene;
    if (!scene) return;
    if (this.ship) {
      scene.remove(this.ship);
      disposeShip(this.ship);
    }
    const ship = createShipModel(spec);
    scene.add(ship);
    this.ship = ship;
    if (this.sea) this.sea.position.y = spec.draft;
    this.goal = null;
    const frame = this.frameOf('quarter', spec);
    this.camera?.position.copy(frame.position);
    this.controls?.target.copy(frame.target);
    if (this.controls) this.controls.autoRotate = this.spinning();
    this.camera?.up.set(0, 1, 0);
  }

  private frameOf(view: View, spec: HullSpec): { position: THREE.Vector3; target: THREE.Vector3 } {
    const length = spec.loa;
    const target = new THREE.Vector3(0, spec.draft + (spec.depth - spec.draft) * 0.8, 0);
    const position = {
      quarter: new THREE.Vector3(length * 0.18, spec.draft + length * 0.11, length * 0.9),
      side: new THREE.Vector3(0, spec.draft + length * 0.07, length * 1.2),
      top: new THREE.Vector3(0, length * 1.05, 0.4),
      bow: new THREE.Vector3(length * 0.62, spec.draft + length * 0.1, length * 0.24),
      stern: new THREE.Vector3(-length * 0.55, spec.draft + length * 0.12, length * 0.28),
    }[view];
    return { position, target };
  }

  private resizeTo(canvas: HTMLCanvasElement): void {
    const host = canvas.parentElement;
    const renderer = this.renderer;
    const camera = this.camera;
    if (!host || !renderer || !camera) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  private draw = (): void => {
    this.frame = requestAnimationFrame(this.draw);
    const camera = this.camera;
    const controls = this.controls;
    const renderer = this.renderer;
    const scene = this.scene;
    if (!camera || !controls || !renderer || !scene) return;
    if (this.goal && this.goalTarget) {
      controls.autoRotate = false;
      camera.position.lerp(this.goal, 0.08);
      controls.target.lerp(this.goalTarget, 0.12);
      if (camera.position.distanceTo(this.goal) < 0.35) {
        this.goal = null;
        controls.autoRotate = this.spinning();
      }
    }
    controls.update();
    renderer.render(scene, camera);
  };

  private destroy(): void {
    cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    this.controls?.dispose();
    if (this.ship) disposeShip(this.ship);
    this.sea?.geometry.dispose();
    const seaMaterial = this.sea?.material;
    if (seaMaterial && !Array.isArray(seaMaterial)) {
      (seaMaterial as THREE.MeshStandardMaterial).map?.dispose();
      seaMaterial.dispose();
    }
    this.renderer?.dispose();
    this.renderer = null;
  }
}
