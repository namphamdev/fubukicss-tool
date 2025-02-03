import { toTailwindcss } from 'transform-to-tailwindcss-core'
import { toUnocssClass } from 'transform-to-unocss-core'

const convertRgbaToHex = (rgba: string) => {
  // Regular expression to match rgba values
  const rgbaRegex = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/

  // Function to convert a single rgba color to hex
  function rgbaToHex(r, g, b, a) {
    r = Number(r).toString(16).padStart(2, '0')
    g = Number(g).toString(16).padStart(2, '0')
    b = Number(b).toString(16).padStart(2, '0')
    a = Math.round(Number(a) * 255)
      .toString(16)
      .padStart(2, '0')
    return `#${r}${g}${b}${a}`
  }

  // Replace rgba values with hex
  return rgba.replace(rgbaRegex, (match, r, g, b, a) => rgbaToHex(r, g, b, a))
}

const extractVar = (style: string) => {
  // padding: var(--spacing-xs, 4px) var(--spacing-none, 0px)
  // border-radius: var(--radius-xl, 12px)
  return style.replace(/var\(--[^,]+,\s*([^)]+)\)/g, (match, fallback) => {
    return fallback.trim()
  })
}

const toTailwind = (style: string, isRem: boolean) => {
  if (style.includes('letter-spacing:')) {
    // letter-spacing: -0.32px to tracking-[-0.32px]
    return `tracking-[${style.replace('letter-spacing: ', '')}]`
  } else if (style === 'font-style: normal') {
    return 'font-normal'
  } else if (style.includes('rgba')) {
    // convert rgba
    return toTailwindcss(convertRgbaToHex(style), isRem)
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
