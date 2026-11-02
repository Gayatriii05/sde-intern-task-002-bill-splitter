import { memberColor } from '../lib/colors'

type Props = { name: string; index: number }

export function Avatar({ name, index }: Props) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?'
  return (
    <span className="avatar" style={{ backgroundColor: memberColor(index) }} aria-hidden="true">
      {initial}
    </span>
  )
}
