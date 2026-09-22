import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Catches render-time exceptions so a failure shows a message instead of a blank
 * page.
 *
 * An uncaught render error unmounts the whole tree, which leaves nothing on
 * screen but a console trace — the least useful possible outcome for whoever is
 * looking at it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="aurora flex min-h-dvh items-center justify-center px-5 py-12">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Something broke while rendering</CardTitle>
            <p className="text-sm text-muted">
              This is a bug in the application rather than a configuration problem. The message
              below is the actual error, and the browser console has the component stack.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 text-sm">
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-white/[0.04] p-3 text-xs text-muted">
              {error.name}: {error.message}
            </pre>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              <RefreshCw />
              Reload
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
