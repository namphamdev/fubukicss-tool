import { toTailwindcss } from 'transform-to-tailwindcss-core'
import { toUnocssClass } from 'transform-to-unocss-core'

const convertRgbaToHex = (rgba: string) => {
  // background: rgba(41, 37, 36, 0.50) to background: #29252480
  const color = rgba.match(/\((.*)\)/g)?.[0]
  const [r, g, b, a] =
    color
      ?.replace('(', '')
      .replace(')', '')
      .split(',')
      .map((i) => i.trim()) || []
  const rNumber = Number(r)
  const gNumber = Number(g)
  const bNumber = Number(b)
  const aNumber = Number(a)
  if (!rNumber || !gNumber || !bNumber || !aNumber) return rgba
  // Convert r, g, b to hex
  const toHex = (c: number) => {
    const hex = c.toString(16)
    return hex.length === 1 ? '0' + hex : hex // Ensure two digits
  }

  // Convert alpha to hex (0-1 to 00-FF)
  const alphaHex = Math.round(aNumber * 255)
  const alpha = alphaHex.toString(16).padStart(2, '0') // Ensure two digits

  // Return the hex representation
  return `#${toHex(rNumber)}${toHex(gNumber)}${toHex(bNumber)}${alpha}`
}

const extractVar = (style: string) => {
  // padding: var(--spacing-xs, 4px) var(--spacing-none, 0px)
  // border-radius: var(--radius-xl, 12px)
  return style.replace(/var\(--[^,]+,\s*([^)]+)\)/g, (match, fallback) => {
    return fallback.trim()
  })
}

const toTailwind = (style: string, isRem: boolean) => {
  console.log('toTailwind', style)
  if (style.includes('letter-spacing:')) {
    // letter-spacing: -0.32px to tracking-[-0.32px]
    return `tracking-[${style.replace('letter-spacing: ', '')}]`
  } else if (style === 'font-style: normal') {
    return 'font-normal'
  } else if (style.includes('background: rgba')) {
    // convert rgba
    return `bg-[${convertRgbaToHex(style)}]`
  }
  return toTailwindcss(style, isRem)
}

export const transformToAtomic = (
  style: Record<string, string>,
  options: { engine: 'unocss' | 'tailwind'; isRem: boolean; prefix: string },
) => {
  const { engine = 'unocss', isRem = false, prefix = '' } = options
  const raw = Object.entries(style)

  const cssCode = raw.map(([key, value]) => `${key}: ${value.replace(/\/\*.*\*\//g, '').trim()};`).join('\n')

  const uno = raw
    .map(([key, value]) => `${key}: ${value.replace(/\/\*.*\*\//g, '').trim()}`)
    .map((i) => extractVar(i))
    .map((i) => (engine === 'unocss' ? toUnocssClass(i, isRem)[0] : toTailwind(i, isRem)))
    .map((i) => `${prefix}${i}`)
    .filter((i) => !['undefined', '-webkit-box'].includes(i))
    .join(' ')
    .replace(/border-(\d+\.\d+|\d+)/g, (_, $1) => `border-${Number($1) * 4}`)
    .replace(/(border-[xylrtb]-)(\d+\.\d+|\d+)/g, (_, $1, $2) => `${$1}${Number($2) * 4}`)
    .replace(/(p[xylrtb])-(\d+\.\d+|\d+)px/g, (_, $1, $2) => `${$1}-${$2 / 4}`)

  const unoMini = raw
    .filter(([key]) =>
      ['font-feature-settings', 'font-family', 'text-transform'].every((item) => !key?.startsWith(item)),
    )
    .map(([key, value]) => `${key}: ${value.replace(/\/\*.*\*\//g, '').trim()}`)
    .map((i) => extractVar(i))
    .map((i) => (engine === 'unocss' ? toUnocssClass(i, isRem)[0] : toTailwind(i, isRem)))
    .filter((i) => ['lh-normal', 'font-not-italic', 'bg-[url(]'].every((item) => !i?.startsWith(item)))
    .map((i) => `${prefix}${i}`)
    .filter((i) => !['undefined', '-webkit-box'].includes(i))
    .join(' ')
    .replace(/border-(\d+\.\d+|\d+)/g, (_, $1) => `border-${Number($1) * 4}`)
    .replace(/(border-[xylrtb]-)(\d+\.\d+|\d+)/g, (_, $1, $2) => `${$1}${Number($2) * 4}`)
    .replace(/(p[xylrtb])-(\d+\.\d+|\d+)px/g, (_, $1, $2) => `${$1}-${$2 / 4}`)

  return {
    cssCode,
    uno,
    unoMini,
  }
}
