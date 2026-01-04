import React, { useEffect, useRef } from 'react';

const COLORS = {
  bg: "#000000",
  particleIdle: "rgba(170, 170, 170, 0.5)",
  particleActive: "#ffffff",
  line: "rgba(100, 100, 100, 0.5)",
  glow: "rgba(255, 255, 255, 0.5)",
};

const MAX_DIST = 100;
const MAX_DIST_SQ = MAX_DIST * MAX_DIST;

const Loader = ({ status }) => {
  const canvasRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    const particles = [];
    const mouse = { x: null, y: null };
    let width = window.innerWidth;
    let height = window.innerHeight;

    class Particle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        const speed = 0.08 + Math.random() * 0.1;
        const angle = Math.random() * 2 * Math.PI;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = 1.5;
        this.connected = false;
      }

      update(mouse) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        if (mouse.x !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distSq = dx * dx + dy * dy;
          const mouseInfluenceSq = 50 * 50;

          if (distSq < mouseInfluenceSq) {
            this.connected = true;
            const dist = Math.sqrt(distSq);
            const force = ((mouseInfluenceSq - distSq) / mouseInfluenceSq) * 0.05;
            this.vx -= (dx / dist) * force;
            this.vy -= (dy / dist) * force;
            this.vx *= 0.98;
            this.vy *= 0.98;
          }
        }
      }

      draw() {
        ctx.fillStyle = this.connected ? COLORS.particleActive : COLORS.particleIdle;
        if (this.connected) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.glow;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.shadowBlur = 0;
      }
    }

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      createParticles();
    };

    const createParticles = () => {
      particles.length = 0;
      const area = width * height;
      let count = 280;
      if (area < 600000) count = 200;
      else if (area < 1200000) count = 320;
      else if (area < 2000000) count = 440;

      for (let i = 0; i < count; i++) {
        particles.push(new Particle(Math.random() * width, Math.random() * height));
      }
    };

    const animate = () => {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, width, height);

      particles.forEach(p => p.update(mouse));

      particles.forEach(p => p.connected = false);
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        let closest = null;
        let minDSq = MAX_DIST_SQ;

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dSq = dx * dx + dy * dy;

          if (dSq < minDSq) {
            minDSq = dSq;
            closest = p2;
          }
        }

        if (closest) {
          const d = Math.sqrt(minDSq);
          const alpha = 1 - d / MAX_DIST;
          ctx.strokeStyle = `rgba(100, 100, 100, ${alpha * 0.7})`;
          ctx.lineWidth = alpha * 1.5;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(closest.x, closest.y);
          ctx.stroke();
          p1.connected = true;
          closest.connected = true;
        }
      }

      particles.forEach(p => p.draw());
      requestRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    };
    const handleMouseLeave = () => {
        mouse.x = null;
        mouse.y = null;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    resize();
    animate();

    return () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <div id="app-loader" className="loader-overlay">
      <canvas ref={canvasRef} id="canvas" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}></canvas>
      <div className="loader-content">
        <div className="banter-loader">
          {Array(9).fill(0).map((_, i) => <div key={i} className="banter-loader__box"></div>)}
        </div>
        <div className="card">
          <div className="loader-text-anim">
            <p>loading</p>
            <div className="words">
              <span className="word">modules</span>
              <span className="word">binaries</span>
              <span className="word">interface</span>
              <span className="word">system</span>
              <span className="word">modules</span>
            </div>
          </div>
        </div>
        {status && <p id="loader-status" className="loader-text" style={{display: 'block', whiteSpace: 'pre-wrap'}}>{status}</p>}
      </div>
    </div>
  );
};

export default Loader;
