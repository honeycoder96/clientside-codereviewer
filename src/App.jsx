import { Component } from 'react'
import ReviewDashboard from './components/ReviewDashboard'
import NoWebGPU from './components/model/NoWebGPU'
import Navbar from './components/layout/Navbar'

const gpuSupported = typeof navigator !== 'undefined' && !!navigator.gpu

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message ?? 'Unknown error' }
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', err, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full bg-gray-900 flex items-center justify-center p-6">
          <div className="max-w-md text-center flex flex-col gap-4">
            <p className="text-red-400 font-semibold">Something went wrong</p>
            <p className="text-gray-400 text-sm">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  if (!gpuSupported) return <NoWebGPU />
  return <ReviewDashboard />
}

export default function Root() {
  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-gray-900 overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-hidden">
          <App />
        </div>
      </div>
    </ErrorBoundary>
  )
}
