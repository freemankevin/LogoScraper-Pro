declare module 'imagetracerjs' {
  // ImageTracerJS is loaded via global script in index.html
  // This module declaration suppresses TS7016 for any direct imports
  const ImageTracer: typeof window.ImageTracer
  export default ImageTracer
}
