import { protocol } from 'electron'
import { resolve, sep } from 'path'
import { SettingsService } from './services/settings.service'
import { TagService } from './services/tag.service'

export const ART_SCHEME = 'tvart'

/**
 * Must run before `app.whenReady()`.
 *
 * The scheme is registered as standard + secure so the renderer's CSP treats it
 * like any other image source, and `supportFetchAPI` lets <img> load it.
 */
export function registerArtworkScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ART_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true }
    }
  ])
}

/**
 * Serves the cover art embedded in a track, read on demand.
 *
 * The alternative was shipping every cover over IPC with the file listing,
 * which would push tens of megabytes into the renderer to draw a few 36px
 * thumbnails. Behind a URL, the browser fetches art only for rows that are
 * actually on screen (the <img> tags are `loading="lazy"`) and caches it.
 */
export function handleArtworkProtocol(): void {
  protocol.handle(ART_SCHEME, async (request) => {
    let filePath: string
    try {
      filePath = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''))
    } catch {
      return new Response(null, { status: 400 })
    }

    // A URL is renderer-controlled input. Only ever read inside the music root.
    const root = resolve(SettingsService.load().musicRoot)
    const target = resolve(filePath)
    if (target !== root && !target.startsWith(root + sep)) {
      return new Response(null, { status: 403 })
    }

    const art = await TagService.readArtwork(target)
    if (!art) return new Response(null, { status: 404 })

    return new Response(new Uint8Array(art.data), {
      status: 200,
      headers: {
        'Content-Type': art.mime,
        // The path is stable and the art only changes when the file is retagged.
        'Cache-Control': 'private, max-age=3600'
      }
    })
  })
}
