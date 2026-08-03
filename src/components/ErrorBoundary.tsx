import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '32px',
          fontFamily: 'monospace',
          background: '#1a1a2e',
          color: '#e0e0e0',
          minHeight: '100vh',
          overflow: 'auto'
        }}>
          <h1 style={{ color: '#ff6b6b', fontSize: '20px', marginBottom: '16px' }}>
            ⚠️ App Crashed — Error Details Below
          </h1>
          <div style={{
            background: '#16213e',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #e94560'
          }}>
            <p style={{ color: '#ff6b6b', fontWeight: 'bold', marginBottom: '8px' }}>
              {this.state.error?.name}: {this.state.error?.message}
            </p>
            <pre style={{
              fontSize: '11px',
              color: '#a0a0a0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              {this.state.error?.stack}
            </pre>
          </div>
          {this.state.errorInfo && (
            <div style={{
              background: '#16213e',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #533483'
            }}>
              <p style={{ color: '#b0b0ff', fontWeight: 'bold', marginBottom: '8px' }}>
                Component Stack:
              </p>
              <pre style={{
                fontSize: '11px',
                color: '#a0a0a0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 24px',
              background: '#e94560',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
