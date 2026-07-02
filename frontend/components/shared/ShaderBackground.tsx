'use client'
import { useEffect, useRef } from 'react'

// Landing page fragment shader — verbatim from §4A
const LANDING_FRAG = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.15;
  vec3 cyberPink = vec3(1.0, 0.0, 0.48);
  vec3 coralOrange = vec3(1.0, 0.36, 0.0);
  vec3 neonCitrus = vec3(0.9, 1.0, 0.0);
  vec3 obsidian = vec3(0.03, 0.03, 0.04);
  for (float i = 1.0; i < 5.0; i++) {
    p.x += 0.4 / i * sin(i * 2.0 * p.y + t + sin(t * 0.5));
    p.y += 0.4 / i * cos(i * 2.0 * p.x + t + cos(t * 0.3));
  }
  float dist = length(p);
  vec3 color = obsidian;
  float pulse = sin(dist * 3.0 - t * 2.0) * 0.5 + 0.5;
  color += mix(cyberPink, neonCitrus, pulse) * (0.01 / abs(sin(dist - t)));
  color += coralOrange * (0.005 / abs(cos(p.x + p.y - t)));
  gl_FragColor = vec4(color, 1.0);
}
`

// App workspace shader — §4B: amber/citrus palette, dimmed to ~4%
const APP_FRAG = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.04;
  vec3 amber = vec3(1.0, 0.36, 0.0);
  vec3 citrus = vec3(0.9, 1.0, 0.0);
  vec3 obsidian = vec3(0.03, 0.03, 0.04);
  for (float i = 1.0; i < 5.0; i++) {
    p.x += 0.4 / i * sin(i * 2.0 * p.y + t + sin(t * 0.5));
    p.y += 0.4 / i * cos(i * 2.0 * p.x + t + cos(t * 0.3));
  }
  float dist = length(p);
  vec3 color = obsidian;
  float pulse = sin(dist * 3.0 - t * 2.0) * 0.5 + 0.5;
  color += mix(amber, citrus, pulse) * (0.01 / abs(sin(dist - t)));
  color *= 0.04;
  gl_FragColor = vec4(color, 1.0);
}
`

const VERT = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}

function initWebGL(canvas: HTMLCanvasElement, fragSrc: string) {
  const gl = canvas.getContext('webgl')
  if (!gl) return null
  const vert = createShader(gl, gl.VERTEX_SHADER, VERT)
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc)
  const prog = gl.createProgram()!
  gl.attachShader(prog, vert)
  gl.attachShader(prog, frag)
  gl.linkProgram(prog)
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  const pos = gl.getAttribLocation(prog, 'a_position')
  gl.enableVertexAttribArray(pos)
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

  const uTime = gl.getUniformLocation(prog, 'u_time')
  const uRes = gl.getUniformLocation(prog, 'u_resolution')
  return { gl, prog, uTime, uRes }
}

interface Props { variant: 'landing' | 'app' }

export default function ShaderBackground({ variant }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = initWebGL(canvas, variant === 'landing' ? LANDING_FRAG : APP_FRAG)
    if (!ctx) return
    const { gl, uTime, uRes } = ctx
    let start: number | null = null

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const render = (ts: number) => {
      if (!start) start = ts
      const t = (ts - start) / 1000
      gl.uniform1f(uTime, t)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      rafRef.current = requestAnimationFrame(render)
    }
    rafRef.current = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      id="shader-canvas"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    />
  )
}
