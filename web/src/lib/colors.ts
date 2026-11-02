/** Deep jewel tones for members (no blues or greens). A member keeps the color of their position. */
export const MEMBER_COLORS = [
  '#B5336B',
  '#B4532F',
  '#8E4DA8',
  '#9A6A0C',
  '#C93F62',
  '#7A2E4E',
] as const
export function memberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length] ?? '#B5336B'
}
