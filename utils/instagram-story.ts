import { toPng } from "html-to-image"

type CaptureOptions = {
  width?: number
  height?: number
  pixelRatio?: number
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function captureInviteSnapshot(
  node: HTMLElement,
  opts: CaptureOptions = {}
): Promise<string> {
  const width = opts.width ?? 540
  const height = opts.height ?? 960
  const pixelRatio = opts.pixelRatio ?? 2

  // Render into a fixed-size offscreen container so output is story-sized:
  // 540x960 @2x => 1080x1920.
  const rect = node.getBoundingClientRect()
  const nodeW = Math.max(1, rect.width)
  const nodeH = Math.max(1, rect.height)

  const scale = Math.min((width * 0.9) / nodeW, (height * 0.72) / nodeH)

  const root = document.createElement("div")
  root.style.position = "fixed"
  root.style.left = "-99999px"
  root.style.top = "0"
  root.style.width = `${width}px`
  root.style.height = `${height}px`
  root.style.background = "transparent"
  root.style.overflow = "hidden"
  root.style.display = "flex"
  root.style.alignItems = "center"
  root.style.justifyContent = "center"

  const cloneWrap = document.createElement("div")
  cloneWrap.style.transformOrigin = "center center"
  cloneWrap.style.transform = `scale(${scale})`
  cloneWrap.style.maxWidth = "100%"
  cloneWrap.style.maxHeight = "100%"

  const clone = node.cloneNode(true) as HTMLElement
  cloneWrap.appendChild(clone)
  root.appendChild(cloneWrap)
  document.body.appendChild(root)

  try {
    // Give the browser a tick to paint fonts/images.
    await sleep(50)
    return await toPng(root, {
      pixelRatio,
      width,
      height,
      // Exclude anything explicitly marked as ignored.
      filter: (n) => !(n as HTMLElement)?.dataset?.ignoreCapture,
    })
  } finally {
    root.remove()
  }
}

export async function generateStoryImage(params: {
  snapshotDataUrl: string
  title: string
  sessionTitle: string
  sessionWhen: string
  inviteLink: string
}): Promise<{ blob: Blob; dataUrl: string }> {
  const W = 1080
  const H = 1920

  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported")

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, "#0B0F1A")
  grad.addColorStop(0.55, "#0B1220")
  grad.addColorStop(1, "#05070D")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Subtle glow
  ctx.save()
  ctx.globalAlpha = 0.35
  const glow = ctx.createRadialGradient(W * 0.25, H * 0.12, 10, W * 0.25, H * 0.12, 520)
  glow.addColorStop(0, "#22C55E")
  glow.addColorStop(1, "rgba(34,197,94,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  // Header text
  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.textAlign = "center"
  ctx.textBaseline = "top"

  ctx.font = "700 56px system-ui, -apple-system, Segoe UI, Roboto, Arial"
  ctx.fillText(params.title, W / 2, 90)

  ctx.font = "600 44px system-ui, -apple-system, Segoe UI, Roboto, Arial"
  const titleLines = wrapText(ctx, params.sessionTitle, 880)
  let y = 170
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, W / 2, y)
    y += 52
  }

  ctx.font = "500 30px system-ui, -apple-system, Segoe UI, Roboto, Arial"
  ctx.fillStyle = "rgba(255,255,255,0.72)"
  ctx.fillText(params.sessionWhen, W / 2, y + 6)

  // Snapshot - center it in the canvas
  const snapImg = await loadImage(params.snapshotDataUrl)
  const snapW = W * 0.85 // Use 85% of width to leave margins
  const snapH = (snapImg.height / snapImg.width) * snapW // Maintain aspect ratio
  const snapX = (W - snapW) / 2
  const snapY = 320 // Position below header text
  ctx.save()
  ctx.globalAlpha = 0.95
  ctx.drawImage(snapImg, snapX, snapY, snapW, snapH)
  ctx.restore()

  // Footer: link + CTA
  const footerY = 1680
  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.font = "700 34px system-ui, -apple-system, Segoe UI, Roboto, Arial"
  ctx.fillText("Add link sticker →", W / 2, footerY)

  ctx.fillStyle = "rgba(255,255,255,0.75)"
  ctx.font = "500 26px system-ui, -apple-system, Segoe UI, Roboto, Arial"
  const linkLines = wrapText(ctx, params.inviteLink, 920)
  let ly = footerY + 54
  for (const line of linkLines.slice(0, 2)) {
    ctx.fillText(line, W / 2, ly)
    ly += 34
  }

  const dataUrl = canvas.toDataURL("image/png")
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to export image"))), "image/png")
  })

  return { blob, dataUrl }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    if (ctx.measureText(test).width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [text]
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.left = "-99999px"
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand("copy")
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export async function tryWebShare(params: {
  blob: Blob
  filename: string
  title?: string
  text?: string
}): Promise<boolean> {
  const nav: any = navigator as any
  if (!nav?.share) return false
  try {
    const file = new File([params.blob], params.filename, { type: "image/png" })
    if (nav.canShare && !nav.canShare({ files: [file] })) return false
    await nav.share({
      title: params.title,
      text: params.text,
      files: [file],
    })
    return true
  } catch {
    return false
  }
}

