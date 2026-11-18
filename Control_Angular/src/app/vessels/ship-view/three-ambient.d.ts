declare module 'three' {
  export const SRGBColorSpace: string;
  export const ACESFilmicToneMapping: number;
  export const PCFSoftShadowMap: number;
  export const DoubleSide: number;

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    add(v: Vector3): this;
    subVectors(a: Vector3, b: Vector3): this;
    multiplyScalar(s: number): this;
    length(): number;
    normalize(): this;
  }

  export class Euler {
    x: number;
    y: number;
    z: number;
  }

  export class Quaternion {
    setFromUnitVectors(from: Vector3, to: Vector3): void;
  }

  export class Color {
    constructor(color: string);
    r: number;
    g: number;
    b: number;
  }

  export class Object3D {
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    quaternion: Quaternion;
    castShadow: boolean;
    receiveShadow: boolean;
    add(...objects: Object3D[]): this;
    traverse(callback: (object: Object3D) => void): void;
    updateMatrixWorld(force?: boolean): void;
  }

  export class Group extends Object3D {}

  export class BufferGeometry {
    setAttribute(name: string, attribute: Float32BufferAttribute): void;
    setIndex(indices: number[]): void;
    computeVertexNormals(): void;
    dispose(): void;
  }

  export class Float32BufferAttribute {
    constructor(array: number[], itemSize: number);
  }

  export class BoxGeometry extends BufferGeometry {
    constructor(width: number, height: number, depth: number);
  }

  export class CylinderGeometry extends BufferGeometry {
    constructor(radiusTop: number, radiusBottom: number, height: number, radialSegments?: number);
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(radius: number, widthSegments: number, heightSegments: number);
  }

  export class PlaneGeometry extends BufferGeometry {
    constructor(width: number, height: number);
  }

  export class CircleGeometry extends BufferGeometry {
    constructor(radius: number, segments: number);
  }

  export class Material {
    dispose(): void;
  }

  export class Texture {
    isTexture: boolean;
    dispose(): void;
  }

  export class CanvasTexture extends Texture {
    constructor(canvas: HTMLCanvasElement);
    colorSpace: string;
    anisotropy: number;
    needsUpdate: boolean;
  }

  export class MeshStandardMaterial extends Material {
    constructor(parameters?: {
      color?: string;
      roughness?: number;
      metalness?: number;
      vertexColors?: boolean;
      side?: number;
      map?: Texture;
      transparent?: boolean;
      alphaTest?: number;
      polygonOffset?: boolean;
      polygonOffsetFactor?: number;
      polygonOffsetUnits?: number;
    });
  }

  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material);
    geometry: BufferGeometry;
    material: Material | Material[];
  }

  export class Box3 {
    setFromObject(object: Object3D): this;
    getCenter(target: Vector3): Vector3;
  }

  export class Scene extends Object3D {
    background: Color | null;
    fog: Fog | null;
  }

  export class Fog {
    constructor(color: string, near: number, far: number);
  }

  export class PerspectiveCamera extends Object3D {
    constructor(fov: number, aspect: number, near: number, far: number);
    aspect: number;
    lookAt(x: number, y: number, z: number): void;
    updateProjectionMatrix(): void;
  }

  export class OrthographicCamera {
    left: number;
    right: number;
    top: number;
    bottom: number;
    near: number;
    far: number;
  }

  export class HemisphereLight extends Object3D {
    constructor(skyColor: string, groundColor: string, intensity: number);
  }

  export class DirectionalLight extends Object3D {
    constructor(color: string, intensity: number);
    shadow: {
      mapSize: { set(width: number, height: number): void };
      bias: number;
      camera: OrthographicCamera;
    };
  }

  export class WebGLRenderer {
    constructor(parameters?: { antialias?: boolean; alpha?: boolean });
    outputColorSpace: string;
    toneMapping: number;
    toneMappingExposure: number;
    shadowMap: { enabled: boolean; type: number };
    domElement: HTMLCanvasElement;
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setAnimationLoop(callback: ((time: number) => void) | null): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
    dispose(): void;
    getContext(): WebGLRenderingContext | null;
  }
}
