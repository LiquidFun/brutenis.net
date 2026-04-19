const yarnColors = [
  "var(--color-yarn-coral)",
  "var(--color-yarn-teal)",
  "var(--color-yarn-yellow)",
  "var(--color-yarn-purple)",
  "var(--color-yarn-pink)",
  "var(--color-yarn-blue)",
  "var(--color-yarn-green)",
  "var(--color-yarn-orange)",
];

export function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return yarnColors[Math.abs(hash) % yarnColors.length];
}
