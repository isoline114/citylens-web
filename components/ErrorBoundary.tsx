'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { reportError } from '@/lib/error-reporting';

type Props = {
  title: string;
  children: ReactNode;
  message?: string;
  testId?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, {
      boundary: this.props.title,
      componentStack: errorInfo.componentStack,
    });
  }

  override render() {
    if (this.state.error) {
      return (
        <div
          className="border-t border-rule bg-white px-4 py-3 text-sm text-red-700"
          data-testid={this.props.testId}
        >
          <div className="font-medium">{this.props.title} failed to render</div>
          <div className="mt-1">{this.props.message ?? 'There was a client-side rendering error.'}</div>
          <div className="mt-2 whitespace-pre-wrap text-xs text-red-700">{this.state.error.message}</div>
        </div>
      );
    }

    return this.props.children;
  }
}
