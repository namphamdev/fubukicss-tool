import { useAtomValue } from 'jotai'
import { memo, useEffect, useState } from 'react'
import { Clipboard } from 'react-feather'
import SVG from 'react-inlinesvg'
import { useCopyToClipboard } from 'usehooks-ts'

import { arrayBufferToBase64, arrayBufferToImageFile } from '@/entrypoints/utils/file'

import { currentSelection, exportExt, exportScale } from '../store'

function isSVG(node: SceneNode, depth: number = 0): boolean {
  if (depth >= 4) return true // Max depth reached, assume it's SVG

  if ('children' in node && node.children.length > 0) {
    return node.children.every((child) => isSVG(child, depth + 1))
  } else {
    return ['VECTOR', 'ELLIPSE', 'RECTANGLE', 'POLYGON', 'POLYLINE', 'STAR', 'LINE'].includes(node.type)
  }
}
function convertSvgToRNSvg(svgString: string) {
  // Remove XML declaration and DOCTYPE
  let cleaned = svgString.replace(/<\?xml.*?\?>/, '').replace(/<!DOCTYPE.*?>/, '')

  // Convert style attribute to object syntax
  cleaned = cleaned.replace(/style="([^"]*)"/, (match, style) => {
    const styleObject = style
      .split(';')
      .filter(Boolean)
      .reduce((acc: Record<string, string>, current: string) => {
        const [property, value] = current.split(':').map((str) => str.trim())
        // Convert kebab-case to camelCase
        const camelCaseProp = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
        acc[camelCaseProp] = value
        return acc
      }, {})
    return `style={${JSON.stringify(styleObject)}}`
  })

  // Convert HTML attributes to React Native format
  cleaned = cleaned
    // class to className
    .replace(/class=/g, 'className=')
    // Convert kebab-case attributes to camelCase
    .replace(/([a-z])-([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase())
    // Convert fill-rule to fillRule
    .replace(/fill-rule/g, 'fillRule')
    // Convert clip-rule to clipRule
    .replace(/clip-rule/g, 'clipRule')
    // Convert stroke-width to strokeWidth
    .replace(/stroke-width/g, 'strokeWidth')
    // Convert xlink:href to xlinkHref
    .replace(/xlink:href/g, 'xlinkHref')

  // Convert colors to string format
  cleaned = cleaned.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,6})"/g, '$1="$2"')

  // Convert SVG tags to uppercase
  cleaned = cleaned.replace(/<\/?([a-z-]+)([\s>])/g, (match, tag, ending) => {
    // List of SVG elements that need to be capitalized
    const svgTags = {
      svg: 'Svg',
      circle: 'Circle',
      path: 'Path',
      rect: 'Rect',
      line: 'Line',
      polyline: 'Polyline',
      polygon: 'Polygon',
      ellipse: 'Ellipse',
      g: 'G',
      text: 'Text',
      tspan: 'TSpan',
      defs: 'Defs',
      linearGradient: 'LinearGradient',
      radialGradient: 'RadialGradient',
      stop: 'Stop',
      clipPath: 'ClipPath',
      mask: 'Mask',
      pattern: 'Pattern',
      image: 'Image',
      use: 'Use',
    }

    const capitalizedTag = svgTags[tag as keyof typeof svgTags] || tag
    return match.replace(tag, capitalizedTag)
  })

  // Self-closing tags
  cleaned = cleaned.replace(/<([A-Za-z]+)([^>]*)>\s*<\/[^>]+>/g, '<$1$2 />')

  return cleaned
}

export const Download = memo((props: { minimized?: boolean }) => {
  const node = useAtomValue(currentSelection)
  const [imageBase64, setImageBase64] = useState('')
  const [svgString, setSvgString] = useState('')
  const scale = useAtomValue(exportScale)
  const ext = useAtomValue(exportExt)

  const [show, setShow] = useState(false)

  const [_, copy] = useCopyToClipboard()

  const handleCopy = (text: string) => () => {
    copy(text)
      .then(() => {
        figma?.notify('Copied to clipboard')
      })
      .catch(() => {
        figma?.notify('Failed to copy!', {
          error: true,
        })
      })
  }

  const handleReactNative = () => {
    const svgData = convertSvgToRNSvg(svgString)
    setSvgString(svgData)
    handleCopy(svgData)
  }

  const onDownload = async () => {
    const data =
      ext === 'svg'
        ? await node?.exportAsync({
            format: 'SVG_STRING',
          })
        : await node?.exportAsync({
            format: ext.toUpperCase() as 'PNG',
            constraint: {
              type: 'SCALE',
              value: scale,
            },
          })
    if (data) {
      arrayBufferToImageFile(
        data,
        node?.name ? `${node?.name}.${ext}` : 'fubukitool.png',
        `image/${ext === 'svg' ? 'svg+xml' : ext}`,
      )
    }
  }

  const onDownloadBackground = async () => {
    let data: any
    // @ts-ignore
    if (node?.children?.length > 0) {
      try {
        // @ts-ignore
        node.children.forEach((child: any) => {
          child.opacity = 0
        })
        data = await node?.exportAsync({
          format: ext.toUpperCase() as 'PNG',
          constraint: {
            type: 'SCALE',
            value: scale,
          },
        })
      } catch (e) {
        figma?.notify('You must have edit permission to export background only', {
          error: true,
        })
        return
      }
    } else {
      data = await node?.exportAsync({
        format: ext.toUpperCase() as 'PNG',
        constraint: {
          type: 'SCALE',
          value: scale,
        },
      })
    }

    if (data) {
      arrayBufferToImageFile(
        data,
        node?.name ? `${node?.name}.${ext}` : 'fubukitool.png',
        `image/${ext === 'svg' ? 'svg+xml' : ext}`,
      )
    }
  }

  useEffect(() => {
    ;(async () => {
      if (node) {
        if (isSVG(node)) {
          const svgData = await node.exportAsync({
            format: 'SVG_STRING',
          })
          const svgBase64 = 'data:image/svg+xml;base64,' + btoa(svgData)
          setImageBase64(svgBase64)
          setSvgString(svgData)
        } else {
          const data = await node.exportAsync({
            format: 'PNG',
            constraint: {
              type: 'SCALE',
              value: 1,
            },
          })
          setImageBase64('data:image/png;base64,' + arrayBufferToBase64(data))
          setSvgString('')
        }
      } else {
        setImageBase64('')
      }
    })()
  }, [ext, node, scale])

  return (
    <div
      className={`${props.minimized ? 'hidden' : 'block'} p-4 border-t border-$color-border border-solid text-13px space-y-4`}
    >
      <div className="flex items-center gap-2">
        <span className="flex-1 font-550">Export</span>
        <span
          className="flex items-center gap-.5 text-xs text-$color-text-secondary cursor-pointer"
          onClick={() => handleReactNative()}
        >
          React native
        </span>
        <span
          className="flex items-center gap-.5 text-xs text-$color-text-secondary cursor-pointer"
          onClick={() => setShow(!show)}
        >
          <span className={`w-3 h-3 ${show ? 'rotate-90' : ''} i-fe:play`}></span>
          Preview
        </span>
        <span
          className="w-4 h-4 text-$color-text-secondary hover:text-$color-text cursor-pointer i-fe:download"
          onClick={onDownload}
        ></span>
        <span
          className="w-4 h-4 text-blue-400 hover:text-$color-text cursor-pointer i-fe:download"
          onClick={onDownloadBackground}
        ></span>
      </div>
      {imageBase64 && show && (
        <div
          className="relative mt-4 flex-col-center rounded-sm"
          style={{
            background:
              'conic-gradient(#fff .25turn,#f7f7f7 .25turn .5turn,#fff .5turn .75turn,#f7f7f7 .75turn) top left/20px 20px repeat',
          }}
        >
          {svgString ? (
            <SVG src={svgString} height="100%" className="min-w-20 p-5 max-h-210px max-w-60" />
          ) : (
            <img src={imageBase64} alt="" className="w-full max-w-60 max-h-210px h-auto object-contain" />
          )}
        </div>
      )}
      {svgString && (
        <div className="flex flex-col items-stretch bg-#f5f5f5 rounded-sm overflow-hidden">
          <div className="px-4 h-8 flex-center justify-between border-b border-$color-border border-solid">
            <span className="text-$color-text-secondary text-xs">svg</span>
            <Clipboard
              size={16}
              className="cursor-pointer text-$color-text-secondary hover:text-$color-text"
              onClick={handleCopy(svgString)}
            />
          </div>
          <textarea
            value={svgString}
            readOnly
            rows={0}
            autoComplete="off"
            className="px-4 h-auto py-4 lh-4.5 bg-#f5f5f5 cursor-text text-xs font-['Roboto_Mono'] text-$color-text resize-none scrollbar-hide"
          ></textarea>
        </div>
      )}
    </div>
  )
})
