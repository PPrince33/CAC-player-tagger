'use client';
import { useRef, useEffect, useCallback } from 'react';
import { useTaggerStore } from '@/store/taggerStore';
import { needsEndPoint } from '@/lib/cacLogic';

const PITCH_W = 120;
const PITCH_H = 80;

export default function PitchCanvas({ readOnly = false, highlightCoords = null }) {
  const canvasRef = useRef(null);
  const { startCoord, endCoord, drawingPhase, action, setStartCoord, setEndCoord, clearCoords } =
    useTaggerStore();

  const needsEnd = needsEndPoint(action);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;

    ctx.clearRect(0, 0, W, H);
    drawPitch(ctx, W, H);

    const coords = highlightCoords ?? { start: startCoord, end: endCoord };

    if (coords.start) {
      const [px, py] = toPixel(coords.start.x, coords.start.y, W, H);
      drawDot(ctx, px, py, '#ef4444', 6);
    }
    if (coords.end) {
      const [px, py] = toPixel(coords.end.x, coords.end.y, W, H);
      drawDot(ctx, px, py, '#34D399', 6);
    }
    if (coords.start && coords.end) {
      const [sx, sy] = toPixel(coords.start.x, coords.start.y, W, H);
      const [ex, ey] = toPixel(coords.end.x, coords.end.y, W, H);
      drawArrow(ctx, sx, sy, ex, ey);
    }
  }, [startCoord, endCoord, highlightCoords]);

  const handleClick = useCallback((e) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const xPct   = ((e.clientX - rect.left) / rect.width)  * 100;
    const yPct   = ((e.clientY - rect.top)  / rect.height) * 100;
    const coord  = { x: +xPct.toFixed(2), y: +yPct.toFixed(2) };

    if (drawingPhase === 'start') {
      setStartCoord(coord);
    } else if (drawingPhase === 'end' && needsEnd) {
      setEndCoord(coord);
    } else if (drawingPhase === 'end' && !needsEnd) {
      clearCoords();
      setStartCoord(coord);
    }
  }, [drawingPhase, needsEnd, setStartCoord, setEndCoord, clearCoords, readOnly]);

  const cursor = readOnly ? 'default' : (drawingPhase === 'done' ? 'default' : 'crosshair');

  return (
    <div className="space-y-1">
      <canvas
        ref={canvasRef}
        width={340} height={220}
        onClick={handleClick}
        style={{ cursor, width: '100%', height: 'auto', display: 'block' }}
        className="border-2 border-black bg-green-900"
      />
      {!readOnly && (
        <div className="flex items-center justify-between text-xs font-bold text-gray-600">
          <span>
            {drawingPhase === 'start' && 'Click to set start position'}
            {drawingPhase === 'end'   && (needsEnd ? 'Click to set end position' : 'Start set — click Clear or log event')}
            {drawingPhase === 'done'  && `S: ${startCoord?.x.toFixed(1)},${startCoord?.y.toFixed(1)}  E: ${endCoord?.x.toFixed(1)},${endCoord?.y.toFixed(1)}`}
          </span>
          <button onClick={clearCoords}
            className="border-2 border-black px-2 py-0.5 text-xs font-bold hover:bg-red-500 hover:text-white hover:border-red-500 transition-none">
            Clear
          </button>
        </div>
      )}
      {readOnly && highlightCoords?.start && (
        <p className="text-xs font-bold text-gray-500">
          S: {highlightCoords.start.x},{highlightCoords.start.y}
          {highlightCoords.end && ` → E: ${highlightCoords.end.x},${highlightCoords.end.y}`}
        </p>
      )}
    </div>
  );
}

function toPixel(xPct, yPct, W, H) {
  return [(xPct / 100) * W, (yPct / 100) * H];
}

function drawPitch(ctx, W, H) {
  ctx.fillStyle = '#166534';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth   = 1;

  function px(x) { return (x / PITCH_W) * W; }
  function py(y) { return (y / PITCH_H) * H; }
  function rect(x, y, w, h) { ctx.strokeRect(px(x), py(y), px(w) - px(0), py(h) - py(0)); }

  rect(0, 0, PITCH_W, PITCH_H);
  ctx.beginPath(); ctx.moveTo(px(60), py(0)); ctx.lineTo(px(60), py(PITCH_H)); ctx.stroke();
  ctx.beginPath(); ctx.arc(px(60), py(40), (18 / PITCH_W) * W, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(px(60), py(40), 2, 0, Math.PI * 2); ctx.fill();

  rect(0,   18, 18, 44);
  rect(102, 18, 18, 44);
  rect(0,   30, 6,  20);
  rect(114, 30, 6,  20);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(px(12),  py(40), 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(px(108), py(40), 2, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  rect(-2,  34, 2, 12);
  rect(120, 34, 2, 12);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0,     py(34), 4, py(12) - py(0));
  ctx.fillRect(W - 4, py(34), 4, py(12) - py(0));
}

function drawDot(ctx, x, y, color, radius = 5) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawArrow(ctx, sx, sy, ex, ey) {
  const angle   = Math.atan2(ey - sy, ex - sx);
  const headLen = 10;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth   = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth   = 2;
  ctx.stroke();
}
