import { useMemo, useRef, useState } from 'react'
import {
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'
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
  const [status, setStatus] = useState<'all' | 'todo' | 'done'>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastToggled = useRef<string | null>(null)

  const filtered = useMemo(() => {
    const byStatus =
      status === 'all'
        ? files
        : files.filter((f) => (status === 'done' ? f.transferred : !f.transferred))
    const q = query.trim().toLowerCase()
    if (!q) return byStatus
    // Search the real metadata too, not just the filename — "jazz" should find
    // tracks by genre.
    return byStatus.filter((f) =>
      [f.name, f.folder, f.tags?.title, f.tags?.artist, f.tags?.album, f.tags?.genre]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(q))
    )
  }, [files, query, status])

  const movedCount = files.filter((f) => f.transferred).length

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

  const mark = async (paths: string[], transferred: boolean): Promise<void> => {
    try {
      await api.devices.setTransferred(deviceId, paths, transferred)
      setSelected(new Set())
      await onChanged()
    } catch (err) {
      toastError(err)
    }
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

        {/* Always available: previously this vanished the moment one file was
            selected, leaving no way to then select everything. */}
        <Button
          size="sm"
          disabled={!filtered.length}
          onClick={() => setSelected(allSelected ? new Set() : new Set(visiblePaths))}
        >
          {allSelected ? 'Select none' : 'Select all'}
        </Button>

        {selected.size > 0 && (
          <>
            <span className="tabular text-sm text-text-muted">{selected.size} selected</span>
            <Button size="sm" variant="primary" onClick={() => void mark([...selected], true)}>
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              Mark as on iPod
            </Button>
            <Button size="sm" onClick={() => void mark([...selected], false)}>
              <ArrowUturnLeftIcon className="h-4 w-4" aria-hidden="true" />
              Unmark
            </Button>
            <Button size="sm" variant="danger" onClick={() => void trash([...selected])}>
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
              Move to Trash
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ['all', `All ${files.length}`],
            ['todo', `Not moved yet ${files.length - movedCount}`],
            ['done', `On iPod ${movedCount}`]
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            className={`tabular rounded-full px-2.5 py-1 text-xs transition-colors ${
              status === value
                ? 'bg-accent text-ink'
                : 'bg-surface-2 text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
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
                  <span
                    role="button"
                    tabIndex={0}
                    title={`Select everything in ${g.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected((prev) => {
                        const next = new Set(prev)
                        const paths = g.files.map((f) => f.path)
                        const already = paths.every((p) => next.has(p))
                        for (const p of paths) {
                          if (already) next.delete(p)
                          else next.add(p)
                        }
                        return next
                      })
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      e.stopPropagation()
                      ;(e.currentTarget as HTMLElement).click()
                    }}
                    className="shrink-0 rounded px-2 py-1 text-xs text-text-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-text"
                  >
                    select
                  </span>
                  <span className="tabular shrink-0 text-xs text-text-muted">
                    {g.files.filter((f) => f.transferred).length}/{g.files.length} on iPod ·{' '}
                    {formatBytes(g.bytes)}
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

                        {file.transferred && (
                          <span
                            title="On the iPod"
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok"
                          >
                            <CheckCircleSolid className="h-3 w-3" aria-hidden="true" />
                            On iPod
                          </span>
                        )}
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
