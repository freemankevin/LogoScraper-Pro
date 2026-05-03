import { useRef, useEffect } from 'react';

const VERTEX_SHADER = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float u_time;
uniform vec2 u_res;
uniform vec2 u_mouse;

#define HORIZON 0.10

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

vec3 sun(vec2 uv) {
  vec2 sunPos = vec2(0.0, HORIZON + 0.22);
  float d = length(uv - sunPos);
  float sunMask = smoothstep(0.1, 0.095, d);
  vec3 sunCol = vec3(1.0, 0.08, 0.04) * sunMask;
  float glow = exp(-d * 6.0) * 0.5 + exp(-d * 15.0) * 0.4;
  return sunCol + vec3(1.0, 0.16, 0.08) * glow;
}

vec3 sky(vec2 uv) {
  float skyY = clamp((uv.y - HORIZON) / (1.0 - HORIZON), 0.0, 1.0);
  vec3 colBot = vec3(0.16, 0.34, 0.68);
  vec3 colTop = vec3(0.01, 0.04, 0.14);
  vec3 col = mix(colBot, colTop, smoothstep(0.0, 0.6, skyY));
  float dust = hash(floor(uv * 300.0));
  float dustMask = smoothstep(0.2, 1.0, skyY);
  col += vec3(0.45, 0.62, 0.9) * smoothstep(0.995, 0.999, dust) * dustMask * 0.45;
  col += sun(uv);
  return col;
}

vec3 grid(vec2 uv, float t) {
  float roadY = HORIZON - uv.y;
  if (roadY <= 0.0) return vec3(0.0);
  float perspective = 1.5 / roadY;
  float worldX = uv.x * perspective;
  float worldZ = perspective + t * 2.0;
  float zLine = abs(fract(worldZ * 0.33) - 0.5);
  float xLine = abs(fract(worldX * 0.25) - 0.5);
  float zGrid = smoothstep(clamp(perspective * 0.001, 0.01, 0.1), 0.0, zLine);
  float xGrid = smoothstep(clamp(perspective * 0.0005, 0.005, 0.05), 0.0, xLine);
  float gridVal = max(zGrid, xGrid);
  float fadeIn = smoothstep(0.0, 0.08, roadY);
  vec3 gridColor = vec3(0.96, 0.96, 0.99);
  float glw = max(exp(-zLine * 25.0) * 0.2, exp(-xLine * 25.0) * 0.2);
  vec3 col = gridColor * gridVal * fadeIn;
  col += vec3(1.0) * glw * fadeIn * 0.65;
  col += vec3(0.0);
  return col;
}

vec3 mountains(vec2 uv) {
  if (uv.y < HORIZON) return vec3(0.0);
  float au = abs(uv.x);
  float height = (noise(vec2(au * 4.0, 0.0)) * 0.06 + noise(vec2(au * 12.0, 1.0)) * 0.02) * smoothstep(0.1, 0.6, au);
  float mTop = HORIZON + height;
  float mMask = smoothstep(mTop + 0.002, mTop - 0.002, uv.y);
  vec3 col = vec3(0.02, 0.04, 0.1) * mMask;
  float edge = exp(-abs(uv.y - mTop) * 150.0) * smoothstep(0.1, 0.6, au);
  col += vec3(0.24, 0.42, 0.78) * edge * 0.18;
  return col;
}

float vignette(vec2 uv) {
  float d = length(uv * vec2(0.8, 1.0));
  return smoothstep(1.3, 0.3, d);
}

void main() {
  vec2 vpShift = vec2(0.0);
  if (u_mouse.x > 0.0) {
    vec2 mNorm = u_mouse / u_res;
    vpShift = (mNorm - 0.5) * vec2(0.2, 0.1);
  }
  vec2 uv = (gl_FragCoord.xy - u_res * 0.5) / u_res.y - vpShift;
  float t = u_time;
  vec3 col = vec3(0.0);
  if (uv.y >= HORIZON) {
    col = sky(uv);
    vec3 mtn = mountains(uv);
    float mtnMask = step(0.001, mtn.r + mtn.g + mtn.b);
    col = mix(col, mtn, mtnMask);
  }
  col += grid(uv, t);
  float roadY = HORIZON - uv.y;
  if (roadY > 0.0) {
    float perspective = 1.5 / roadY;
    float wZ = perspective + t * 2.0;
    float dash = step(0.5, fract(wZ * 0.15));
    float lineM = smoothstep(clamp(0.003 / (perspective * 0.05 + 0.1), 0.001, 0.01), 0.0, abs(uv.x));
    col += vec3(1.0) * lineM * dash * smoothstep(0.0, 0.05, roadY) * 0.7;
  }
  col *= vignette(uv);
  col += (hash(uv + t) - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export default function VoidShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = createProgram(gl, vs, fs);
    if (!program) return;

    gl.useProgram(program);

    const posLoc = gl.getAttribLocation(program, 'a_pos');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const resLoc = gl.getUniformLocation(program, 'u_res');
    const mouseLoc = gl.getUniformLocation(program, 'u_mouse');

    const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      gl!.viewport(0, 0, canvas.width, canvas.height);
    }

    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      mouseRef.current.x = e.clientX * dpr;
      mouseRef.current.y = (canvas!.offsetHeight - e.clientY) * dpr;
    };
    window.addEventListener('mousemove', handleMouse);

    const startTime = performance.now();

    function render() {
      const time = (performance.now() - startTime) * 0.001;
      gl!.uniform1f(timeLoc, time);
      gl!.uniform2f(resLoc, canvas!.width, canvas!.height);
      gl!.uniform2f(mouseLoc, mouseRef.current.x, mouseRef.current.y);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: '#050505',
        zIndex: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
