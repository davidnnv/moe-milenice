// 3D soap bubbles for the hero (three.js). Loaded lazily after the page shows,
// paused when off-screen or in a background tab, and skipped for reduced motion / no WebGL.
import { useEffect, useRef } from 'react';

export default function Bubbles3D() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return undefined;

    let disposed = false;
    let cleanup = () => {};

    (async () => {
      // Wait until the page is idle so the 3D never slows down the first paint.
      await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 600)));
      if (disposed) return;
      const THREE = await import('three');
      if (disposed) return;

      const small = window.innerWidth < 760;
      const renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
      renderer.domElement.className = 'bubbles3d__canvas';
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 14);

      // Soap-film shader: clear in the middle, rainbow (thin-film) colours at the rim, a bright glint.
      const dark = () => document.documentElement.dataset.theme === 'dark';
      const uniforms = { uTime: { value: 0 }, uDark: { value: dark() ? 1 : 0 } };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        vertexShader: `
          varying vec3 vN; varying vec3 vV; varying vec3 vW;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            vW = normal;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform float uTime; uniform float uDark;
          varying vec3 vN; varying vec3 vV; varying vec3 vW;
          void main() {
            float ndv = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
            float fres = pow(1.0 - ndv, 3.0);
            float swirl = vW.y * 1.7 + vW.x * 0.9 + uTime * 0.25;
            vec3 film = 0.5 + 0.5 * cos(6.2831 * (fres * 1.2 + swirl * 0.3 + vec3(0.0, 0.33, 0.67)));
            film = clamp(mix(vec3(dot(film, vec3(0.333))), film, 1.35), 0.0, 1.0);
            vec3 l = normalize(vec3(-0.45, 0.65, 0.6));
            float spec = pow(max(dot(normalize(vN), normalize(l + normalize(vV))), 0.0), 160.0);
            vec3 col = mix(film, vec3(1.0), spec);
            float a = fres * mix(0.7, 0.8, uDark) + spec * 0.85;
            gl_FragColor = vec4(col * a, a);
          }`,
      });
      const themeObs = new MutationObserver(() => (uniforms.uDark.value = dark() ? 1 : 0));
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

      const geo = new THREE.SphereGeometry(1, small ? 32 : 48, small ? 24 : 32);

      const COUNT = small ? 11 : 20;
      const H = 9;
      const bubbles = [];
      const spawn = (b, fromBottom) => {
        const s = 0.18 + Math.random() ** 2 * (small ? 0.65 : 0.85);
        b.mesh.scale.setScalar(s);
        b.base = s;
        b.x = (Math.random() - 0.5) * (small ? 9 : 16);
        b.z = (Math.random() - 0.5) * 5;
        b.mesh.position.set(b.x, fromBottom ? -H - Math.random() * 3 : (Math.random() - 0.5) * 2 * H, b.z);
        b.speed = 0.35 + Math.random() * 0.55;
        b.phase = Math.random() * Math.PI * 2;
        b.wobble = 0.25 + Math.random() * 0.5;
      };
      for (let i = 0; i < COUNT; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = i;
        scene.add(mesh);
        const b = { mesh };
        spawn(b, false);
        bubbles.push(b);
      }

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      // Mouse parallax + bubbles drift away from the pointer.
      const pointer = new THREE.Vector2(10, 10);
      const look = { x: 0, y: 0 };
      const onMove = (e) => {
        const r = host.getBoundingClientRect();
        pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      const ray = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();

      let visible = true;
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) loop();
      });
      io.observe(host);
      const onVis = () => !document.hidden && loop();
      document.addEventListener('visibilitychange', onVis);

      const clock = new THREE.Clock();
      let raf = 0;
      function loop() {
        cancelAnimationFrame(raf);
        if (disposed || !visible || document.hidden) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        uniforms.uTime.value = t;

        look.x += (pointer.x * 0.9 - look.x) * 0.04;
        look.y += (pointer.y * 0.6 - look.y) * 0.04;
        camera.position.x = look.x;
        camera.position.y = look.y;
        camera.lookAt(0, 0, 0);

        ray.setFromCamera(pointer, camera);
        const hasHit = ray.ray.intersectPlane(plane, hit);

        for (const b of bubbles) {
          const p = b.mesh.position;
          p.y += b.speed * dt;
          p.x = b.x + Math.sin(t * b.wobble + b.phase) * 0.5;
          if (hasHit) {
            const dx = p.x - hit.x;
            const dy = p.y - hit.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 4) {
              const push = (1 - d2 / 4) * 2.2 * dt;
              b.x += dx * push;
              p.y += dy * push;
            }
          }
          // soft "jelly" wobble of the surface
          const k = Math.sin(t * 2.2 + b.phase) * 0.045;
          b.mesh.scale.set(b.base * (1 + k), b.base * (1 - k), b.base);
          b.mesh.rotation.y += dt * 0.3;
        b.mesh.rotation.z = Math.sin(t * 0.3 + b.phase) * 0.4;
          if (p.y > H + 2) spawn(b, true);
        }
        renderer.render(scene, camera);
      }
      loop();
      host.classList.add('is-ready');

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        window.removeEventListener('pointermove', onMove);
        document.removeEventListener('visibilitychange', onVis);
        themeObs.disconnect();
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => {
      /* 3D is decoration only — if it fails, the page works the same */
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={hostRef} className="bubbles3d" aria-hidden="true" />;
}
