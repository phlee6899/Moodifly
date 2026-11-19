import { useRef } from "react";

const clamp = (x) => Math.min(1, Math.max(0, x));

// A draggable 2D map: x = positivity, y = energy.
export default function MoodMap({ mood, onChange }) {
  const ref = useRef(null);

  const update = (e) => {
    const r = ref.current.getBoundingClientRect();
    onChange({
      valence: clamp((e.clientX - r.left) / r.width),
      energy: clamp(1 - (e.clientY - r.top) / r.height),
    });
  };

  const onKey = (e) => {
    const step = e.shiftKey ? 0.1 : 0.03;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onChange({ valence: clamp(mood.valence + m[0]), energy: clamp(mood.energy + m[1]) });
  };

  return (
    <div className="moodmap">
      <div
        ref={ref}
        className="moodmap-field"
        role="slider"
        tabIndex={0}
        aria-label="Mood: positivity and energy"
        aria-valuetext={`Positivity ${Math.round(mood.valence * 100)}%, energy ${Math.round(mood.energy * 100)}%`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => e.buttons && update(e)}
        onKeyDown={onKey}
      >
        <span className="q q-tl">Fired up</span>
        <span className="q q-tr">Bright</span>
        <span className="q q-bl">Blue</span>
        <span className="q q-br">Easy</span>
        <div className="moodmap-dot" style={{ left: `${mood.valence * 100}%`, top: `${(1 - mood.energy) * 100}%` }} />
      </div>
      <div className="moodmap-axes">
        <span>← moodier</span>
        <span>more upbeat →</span>
      </div>
    </div>
  );
}
