import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center space-y-4 p-8">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-lg font-bold text-text-primary">문제가 발생했습니다</h2>
            <p className="text-sm text-text-secondary max-w-md">
              {this.state.error?.message || "알 수 없는 오류가 발생했습니다."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
