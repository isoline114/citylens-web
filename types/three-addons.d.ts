declare module 'three/addons/controls/OrbitControls.js' {
  export class OrbitControls {
    constructor(object: unknown, domElement?: HTMLElement);
    enableDamping: boolean;
    dampingFactor: number;
    enablePan: boolean;
    enableZoom: boolean;
    enableRotate: boolean;
    screenSpacePanning: boolean;
    minDistance: number;
    maxDistance: number;
    update(): void;
    dispose(): void;
  }
}
