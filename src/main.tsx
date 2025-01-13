import React from 'react'
import ReactDOM from 'react-dom/client'
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import App from './App'
import { AuthWrapper } from './MultiplayerHelper';
import outputs from '../amplify_outputs.json';
import './index.css'
import '@aws-amplify/ui-react/styles.css';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WordBlitz Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: 'white'
        }}>
          <h2>Oops! Something went wrong.</h2>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              marginTop: '15px',
              backgroundColor: '#4CAF50',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Reload Game
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

Amplify.configure(outputs);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Authenticator.Provider>
        <AuthWrapper>
          <App />
        </AuthWrapper>
      </Authenticator.Provider>
    </ErrorBoundary>
  </React.StrictMode>
); 