import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unknown error occurred.';
      let isFirestoreError = false;
      
      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError.operationType) {
          isFirestoreError = true;
          errorMessage = `Firestore Error (${parsedError.operationType} on ${parsedError.path}): ${parsedError.error}`;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
          <div className="bg-[#0a0a0a] border border-red-500/30 p-8 rounded-2xl max-w-2xl w-full">
            <h2 className="text-2xl font-serif text-red-500 mb-4">Something went wrong</h2>
            <div className="bg-black/50 p-4 rounded-lg border border-white/5 overflow-auto max-h-96">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {errorMessage}
              </pre>
            </div>
            <button
              className="mt-6 bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return (this.props as any).children;
  }
}
