import { useRef, useEffect } from "react";

function NoiseOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 10;
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 2, width: "100%", height: "100%", opacity: 1 }}
    />
  );
}

function GradientBackground() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animId: number;
    const start = Date.now();

    const update = () => {
      const t = (Date.now() - start) / 1000;
      const hue1 = 230 + Math.sin(t * 0.04) * 30;
      const hue2 = 280 + Math.sin(t * 0.025 + 2) * 40;
      const hue3 = 190 + Math.sin(t * 0.033 + 4) * 25;
      const sat1 = 20 + Math.sin(t * 0.02) * 10;
      const sat2 = 25 + Math.sin(t * 0.03 + 1) * 12;
      const angle = (t * 3) % 360;

      if (divRef.current) {
        divRef.current.style.background = `linear-gradient(${angle}deg, 
          hsl(${hue1}, ${sat1}%, 93%), 
          hsl(${hue3}, ${(sat1 + sat2) / 2}%, 94%), 
          hsl(${hue2}, ${sat2}%, 91%))`;
      }
      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  return <div ref={divRef} className="fixed inset-0" style={{ zIndex: -1 }} />;
}

const PageBackground = () => (
  <>
    <GradientBackground />
    <NoiseOverlay />
  </>
);

export default PageBackground;
