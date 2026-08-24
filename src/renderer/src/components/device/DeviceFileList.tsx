import { useMemo, useRef, useState } from 'react'
import {
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import type { DeviceFile } from '../../../../shared/models'
import { formatBytes, parseTrackFileName } from '../../../../shared/utils'
import { api } from '../../lib/api'
import { toastError } from '../../store/toastStore'
import { Button } from '../ui/Button'
import { Thumbnail } from '../ui/Thumbnail'

interface Props {
  deviceId: string
  files: DeviceFile[]
  onChanged: () => void | Promise<void>
}

interface Group {
  /** Folder name, or '' for files sitting in the device root. */
  folder: string
  label: string
  files: DeviceFile[]
  bytes: number
}

function group(files: DeviceFile[]): Group[] {
  const byFolder = new Map<string, DeviceFile[]>()
  for (const file of files) {
    const list = byFolder.get(file.folder)
    if (list) list.push(file)
    else byFolder.set(file.folder, [file])
  }
  return [...byFolder.entries()]
    .map(([folder, list]) => ({
      folder,
      label: folder || 'Loose files',
      files: list.slice().sort((a, b) => {
        const pa = a.tags?.trackNumber ?? parseTrackFileName(a.name).position
        const pb = b.tags?.trackNumber ?? parseTrackFileName(b.name).position
        if (pa != null && pb != null && pa !== pb) return pa - pb
        return a.name.localeCompare(b.name, undefined, { numeric: true })
      }),
      bytes: list.reduce((sum, f) => sum + f.size, 0)
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * The files actually on the device, grouped by the playlist folder they came
 * from. A flat list repeated the folder name on every single row, which was
 * noise on every row and told you nothing about how much each playlist was
 * costing you.
 */
export function DeviceFileList({ deviceId, files, onChanged }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastToggled = useRef<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return files
    // Search the real metadata too, not just the filename — "jazz" should find
    // tracks by genre.
    return files.filter((f) =>
      [f.name, f.folder, f.tags?.title, f.tags?.artist, f.tags?.album, f.tags?.genre]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(q))
    )
  }, [files, query])

  const groups = useMemo(() => group(filtered), [filtered])
  const visiblePaths = useMemo(() => filtered.map((f) => f.path), [filtered])
  const allSelected = visiblePaths.length > 0 && selected.size === visiblePaths.length

  const toggle = (path: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    lastToggled.current = path
  }

  const trash = async (paths: string[]): Promise<void> => {
    try {
      const removed = await api.devices.deleteTracks(deviceId, paths)
      if (removed > 0) {
        setSelected(new Set())
        await onChanged()
      }
    } catch (err) {
      toastError(err)
    }
  }

  if (files.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-hairline px-6 py-10 text-center text-sm text-text-muted">
        Nothing here yet. Paste a playlist link above, or drop your own files in.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tracks"
            aria-label="Filter tracks"
            className="min-h-10 w-full rounded-[10px] border border-control/50 bg-surface-2 pr-3 pl-9 text-sm"
          />
        </div>

        {selected.size > 0 ? (
          <>
            <span className="tabular text-sm text-text-muted">{selected.size} selected</span>
            <Button size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant="danger" onClick={() => void trash([...selected])}>
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
              Move to Trash
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => setSelected(new Set(visiblePaths))} disabled={!filtered.length}>
            Select all
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="px-1 text-sm text-text-muted">No tracks match “{query}”.</p>
      ) : (
        groups.map((g) => {
          const open = !collapsed.has(g.folder)
          return (
            <section
              key={g.folder || '__root__'}
              className="overflow-hidden rounded-2xl border border-hairline bg-surface"
            >
              <h3>
                <button
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev)
                      if (next.has(g.folder)) next.delete(g.folder)
                      else next.add(g.folder)
                      return next
                    })
                  }
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-2/50"
                >
                  <ChevronRightIcon
                    className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
                      open ? 'rotate-90' : ''
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.label}</span>
                  <span className="tabular shrink-0 text-xs text-text-muted">
                    {g.files.length} · {formatBytes(g.bytes)}
                  </span>
                </button>
              </h3>

              {open && (
                <ul className="divide-y divide-hairline/60 border-t border-hairline">
                  {g.files.map((file) => {
                    // Prefer what the file actually says about itself; the
                    // filename is only a fallback for untagged imports.
                    const parsed = parseTrackFileName(file.name)
                    const title = file.tags?.title || parsed.title
                    const artist = file.tags?.artist || parsed.artist
                    const position = file.tags?.trackNumber ?? parsed.position
                    const detail = [artist, file.tags?.album, file.tags?.genre]
                      .filter(Boolean)
                      .join(' · ')
                    const isSelected = selected.has(file.path)
                    return (
                      <li
                        key={file.path}
                        // Drag a selection out as a group, or just the row under
                        // the cursor if nothing is selected.
                        draggable
                        onDragStart={(e) => {
                          e.preventDefault()
                          api.startDrag(isSelected ? [...selected] : [file.path])
                        }}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 52px' }}
                        className={`group flex cursor-grab items-center gap-3 px-4 transition-colors active:cursor-grabbing ${
                          isSelected ? 'bg-accent/10' : 'hover:bg-surface-2/50'
                        }`}
                      >
                        <label className="flex min-h-13 flex-1 cursor-pointer items-center gap-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(file.path)}
                            aria-label={`Select ${title}`}
                            className="h-4 w-4 shrink-0"
                          />
                          {position != null && (
                            <span className="tabular w-6 shrink-0 text-right text-xs text-text-muted">
                              {position}
                            </span>
                          )}
                          <Thumbnail
                            size={40}
                            src={file.tags?.hasArtwork ? api.artworkUrl(file.path) : undefined}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm leading-tight">{title}</span>
                            <span
                              className="block truncate text-xs leading-tight text-text-muted"
                              title={detail || file.name}
                            >
                              {detail || file.name}
                            </span>
                          </span>
                        </label>

                        <span className="tabular shrink-0 text-xs text-text-muted">
                          {formatBytes(file.size)}
                        </span>
                        {/* Persistent, not hover-only: a control that only exists
                            on hover is unreachable from the keyboard. */}
                        <button
                          onClick={() => void api.devices.revealTrack(deviceId, file.path)}
                          aria-label={`Show ${title} in Finder`}
                          title="Show in Finder"
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-text-muted/50 transition-colors hover:bg-surface-2 hover:text-text group-hover:text-text-muted"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => void trash([file.path])}
                          aria-label={`Move ${title} to the Trash`}
                          title="Move to Trash"
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-text-muted/50 transition-colors hover:bg-surface-2 hover:text-danger group-hover:text-text-muted"
                        >
                          <TrashIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
