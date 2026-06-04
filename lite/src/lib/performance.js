const marks = new Map();

export function mark(name) {
  marks.set(name, performance.now());
}

export function measure(name, startName) {
  const start = marks.get(startName);
  if (start === undefined) return null;
  const durationMs = Math.round(performance.now() - start);
  window.dispatchEvent(new CustomEvent("epivida-lite:measure", { detail: { name, durationMs } }));
  return durationMs;
}
