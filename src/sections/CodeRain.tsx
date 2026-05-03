import { useRef, useEffect } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]()<>/\\|=+-*&%$#@!?;:.,"\'`~';
const FONT_SIZE = 13;
const COL_GAP = FONT_SIZE * 2.2;
const DROP_SPEED_MIN = 0.4;
const DROP_SPEED_MAX = 1.2;

interface Drop {
  x: number;
  y: number;
  speed: number;
  length: number;
  chars: string[];
  active: boolean;
}

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

export default function CodeRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let columns = 0;
    const drops: Drop[] = [];

    function init() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      columns = Math.floor(width / COL_GAP);
      drops.length = 0;

      for (let i = 0; i < columns; i++) {
        const active = Math.random() > 0.35;
        const length = active ? Math.floor(Math.random() * 12) + 4 : 0;
        const chars: string[] = [];
        for (let j = 0; j < length; j++) {
          chars.push(randomChar());
        }
        drops.push({
          x: i * COL_GAP + COL_GAP / 2,
          y: active ? Math.random() * height * 1.5 - height * 0.5 : 0,
          speed: active ? DROP_SPEED_MIN + Math.random() * (DROP_SPEED_MAX - DROP_SPEED_MIN) : 0,
          length,
          chars,
          active,
        });
      }
    }

    init();

    const handleResize = () => {
      init();
    };
    window.addEventListener('resize', handleResize);

    let lastTime = 0;
    function render(time: number) {
      const delta = Math.min(time - lastTime, 50);
      lastTime = time;

      // 半透明覆盖产生短拖尾，整体保持很暗
      ctx!.fillStyle = 'rgba(5, 5, 8, 0.22)';
      ctx!.fillRect(0, 0, width, height);

      ctx!.font = `${FONT_SIZE}px "JetBrains Mono", monospace`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';

      for (const drop of drops) {
        if (!drop.active) continue;

        drop.y += drop.speed * (delta / 16);

        // 超出底部后重置到顶部，并随机休眠部分列
        if (drop.y - drop.length * FONT_SIZE > height + 50) {
          drop.y = -drop.length * FONT_SIZE - Math.random() * 200;
          drop.speed = DROP_SPEED_MIN + Math.random() * (DROP_SPEED_MAX - DROP_SPEED_MIN);
          drop.length = Math.floor(Math.random() * 12) + 4;
          drop.chars = [];
          for (let j = 0; j < drop.length; j++) {
            drop.chars.push(randomChar());
          }
          // 偶尔让这条流休眠
          if (Math.random() > 0.85) {
            drop.active = false;
            setTimeout(() => {
              drop.active = true;
              drop.y = -drop.length * FONT_SIZE;
            }, 2000 + Math.random() * 4000);
          }
        }

        // 随机变换尾部字符
        if (Math.random() > 0.96) {
          const idx = Math.floor(Math.random() * drop.chars.length);
          drop.chars[idx] = randomChar();
        }

        for (let i = 0; i < drop.length; i++) {
          const charY = drop.y - i * FONT_SIZE;
          if (charY < -FONT_SIZE || charY > height + FONT_SIZE) continue;

          if (i === 0) {
            // 头部：偶尔高亮，大部分偏暗
            const isHighlight = Math.random() > 0.97;
            ctx!.fillStyle = isHighlight
              ? 'rgba(0, 229, 255, 0.7)'
              : 'rgba(0, 200, 170, 0.45)';
            ctx!.shadowColor = isHighlight ? 'rgba(0, 229, 255, 0.25)' : 'transparent';
            ctx!.shadowBlur = isHighlight ? 6 : 0;
          } else {
            // 尾部：快速衰减
            const alpha = Math.max(0, (1 - i / drop.length) * 0.18);
            ctx!.fillStyle = `rgba(0, 180, 150, ${alpha})`;
            ctx!.shadowBlur = 0;
          }

          ctx!.fillText(drop.chars[i], drop.x, charY);
        }
        ctx!.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
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
        background: '#050508',
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
