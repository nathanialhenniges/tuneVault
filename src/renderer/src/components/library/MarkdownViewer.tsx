import { lazy, Suspense } from 'react'

const LazyMarkdownContent = lazy(() =>
  import('react-markdown').then((mod) => {
    // Also load remark-gfm in parallel
    return import('remark-gfm').then((gfmMod) => ({
      default: function MarkdownContent({ children }: { children: string }) {
        const Markdown = mod.default
        return <Markdown remarkPlugins={[gfmMod.default]}>{children}</Markdown>
      }
    }))
  })
)

interface MarkdownViewerProps {
  children: string
}

export function MarkdownViewer({ children }: MarkdownViewerProps): JSX.Element {
  return (
    <Suspense fallback={<div className="text-sm text-text-muted animate-pulse">Loading…</div>}>
      <LazyMarkdownContent>{children}</LazyMarkdownContent>
    </Suspense>
  )
}
