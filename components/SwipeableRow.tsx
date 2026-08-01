"use client";

import { useRef, useState } from "react";

// Wraps a row so that on touch devices, swiping left reveals action buttons
// underneath (e.g. Repay, Delete). Desktop is unaffected — the actions are
// reachable via the row's normal controls. Keeps the gesture simple: swipe
// left to open, tap elsewhere or swipe right to close.
export default function SwipeableRow({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions: { label: string; color: string; onClick: () => void }[];
}) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const dragging = useRef(false);

  const MAX = Math.min(actions.length * 84, 220);

  // No actions → render children plainly, no swipe behavior at all.
  if (actions.length === 0) {
    return <div className="bg-white">{children}</div>;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    dragging.current = true;
    setIsDragging(true);
    startX.current = e.clientX;
    startOffset.current = offset;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    let next = startOffset.current + dx;
    if (next > 0) next = 0;
    if (next < -MAX) next = -MAX;
    setOffset(next);
  }
  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    // Snap open or closed based on how far it was pulled.
    setOffset((o) => (o < -MAX / 2 ? -MAX : 0));
  }

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons revealed underneath */}
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => {
              a.onClick();
              setOffset(0);
            }}
            className={`h-full px-4 text-xs font-medium text-white ${a.color}`}
            style={{ width: 84 }}
          >
            {a.label}
          </button>
        ))}
      </div>
      {/* The row content, slides left to reveal actions */}
      <div
        className="relative bg-white touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </div>
  );
}
