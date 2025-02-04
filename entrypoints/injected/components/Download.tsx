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

const convertSvgToReact = async (svgString: string) => {
  // POST request to https://api.react-svgr.com/api/svgr
  const response = await fetch('https://api.react-svgr.com/api/svgr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: svgString,
      options: {
        dimensions: false,
        icon: false,
        native: false,
        typescript: false,
        ref: false,
        memo: false,
        titleProp: false,
        descProp: false,
        expandProps: false,
        replaceAttrValues: {},
        svgProps: {},
        exportType: 'default',
        namedExport: 'ReactComponent',
        jsxRuntime: 'automatic',
        svgo: false,
        svgoConfig: {
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeTitle: false,
                },
              },
            },
          ],
        },
        prettier: true,
        prettierConfig: {
          semi: false,
        },
      },
    }),
  })
  const data = await response.json()
  return data.output.replace('const SvgComponent = () => (\n  ', '').replace('\n)\nexport default SvgComponent\n', '')
}

const convertSvgToReactNative = async (svgString: string) => {
  // POST request to https://api.react-svgr.com/api/svgr
  const response = await fetch('https://api.react-svgr.com/api/svgr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: svgString,
      options: {
        dimensions: false,
        icon: false,
        native: true,
        typescript: false,
        ref: false,
        memo: false,
        titleProp: false,
        descProp: false,
        expandProps: false,
        replaceAttrValues: {},
        svgProps: {},
        exportType: 'default',
        namedExport: 'ReactComponent',
        jsxRuntime: 'automatic',
        svgo: false,
        svgoConfig: {
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeTitle: false,
                },
              },
            },
          ],
        },
        prettier: true,
        prettierConfig: {
          semi: false,
        },
      },
    }),
  })
  const data = await response.json()
  return data.output.replace('const SvgComponent = () => (\n  ', '').replace('\n)\nexport default SvgComponent\n', '')
}

export const Download = memo((props: { minimized?: boolean }) => {
  const node = useAtomValue(currentSelection)
  const [imageBase64, setImageBase64] = useState('')
  const [svgString, setSvgString] = useState('')
  const [reactNativeString, setReactNativeString] = useState('')
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

  const handleReactNative = async () => {
    if (!node) return
    const svgData = await node?.exportAsync({
      format: 'SVG_STRING',
    })
    const reactNativeCode = await convertSvgToReactNative(svgData)
    setSvgString(reactNativeCode)
    handleCopy(reactNativeCode)
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
          const reactCode = await convertSvgToReact(svgData)
          setSvgString(reactCode)
          const reactNativeCode = await convertSvgToReactNative(svgData)
          setReactNativeString(reactNativeCode)
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
      {reactNativeString && (
        <div className="flex flex-col items-stretch bg-#f5f5f5 rounded-sm overflow-hidden">
          <div className="px-4 h-8 flex-center justify-between border-b border-$color-border border-solid">
            <span className="text-$color-text-secondary text-xs">RN Svg</span>
            <Clipboard
              size={16}
              className="cursor-pointer text-$color-text-secondary hover:text-$color-text"
              onClick={handleCopy(reactNativeString)}
            />
          </div>
          <textarea
            value={reactNativeString}
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
