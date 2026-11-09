
import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  label: string;
  onSave: (base64: string) => void;
  existingSignature: string | null;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ label, onSave, existingSignature }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const isLoadedRef = useRef(false);

  // Initialize and handle resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      // Store current drawing if any
      const tempImage = canvas.toDataURL();
      
      // Set buffer size to match display size for 1:1 pixel mapping
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 160;

      // Restore drawing or load initial
      const ctx = canvas.getContext('2d');
      if (isLoadedRef.current || existingSignature) {
        const img = new Image();
        img.src = isLoadedRef.current ? tempImage : (existingSignature || '');
        img.onload = () => {
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          isLoadedRef.current = true;
        };
      }
    };

    resizeCanvas();
    
    const observer = new ResizeObserver(() => {
        resizeCanvas();
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, [existingSignature]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) e.preventDefault();
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) e.preventDefault();
    if (isDrawing) {
      setIsDrawing(false);
      if (canvasRef.current) {
        onSave(canvasRef.current.toDataURL());
      }
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      onSave('');
      isLoadedRef.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-end">
         <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
         <button
            type="button"
            onClick={clear}
            className="text-[10px] text-rose-500 hover:text-rose-700 font-bold uppercase tracking-widest"
          >
            Clear
          </button>
      </div>
      
      <div ref={containerRef} className="w-full border border-slate-200 rounded-2xl bg-white overflow-hidden relative shadow-sm h-[160px]">
          <canvas
              ref={canvasRef}
              className="w-full h-full bg-white cursor-crosshair touch-none block"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
          />
          <div className="absolute bottom-3 right-4 text-[9px] font-black text-slate-200 pointer-events-none select-none uppercase tracking-[0.2em]">
             Authentication Required
          </div>
      </div>
    </div>
  );
};

export default SignaturePad;
