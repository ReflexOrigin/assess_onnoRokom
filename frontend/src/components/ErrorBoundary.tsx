import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
          <div className="card">
            <AlertTriangle size={48} color="#dc2626" style={{ margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              An unexpected error occurred while rendering the application interface.
            </p>
            {this.state.error && (
              <pre
                style={{
                  background: '#f1f5f9',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  textAlign: 'left',
                  overflowX: 'auto',
                  marginBottom: '1.5rem',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button className="btn btn-primary" onClick={this.handleReload}>
              <RefreshCw size={16} /> Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

