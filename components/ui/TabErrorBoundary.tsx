'use client'
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TabErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '7px', color: '#c03028' }}>
            TAB ERROR
          </div>
          <pre style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', padding: '8px', flex: 1, overflow: 'auto' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            RETRY
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
