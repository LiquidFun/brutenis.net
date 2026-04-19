const keys: Record<string, boolean> = {};
const justPressedKeys: Set<string> = new Set();

document.addEventListener("keydown", (e) => {
  if (!keys[e.key]) {
    justPressedKeys.add(e.key);
  }
  keys[e.key] = true;
});

document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

export function isDown(key: string): boolean {
  return !!keys[key];
}

export function justPressed(key: string): boolean {
  return justPressedKeys.has(key);
}

export function clearJustPressed() {
  justPressedKeys.clear();
}

export function isMovementPressed(): boolean {
  return isDown("w") || isDown("a") || isDown("s") || isDown("d") ||
         isDown("W") || isDown("A") || isDown("S") || isDown("D");
}

export function isTypingInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}
