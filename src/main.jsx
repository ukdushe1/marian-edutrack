import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Development only: ?preview=shell shows the layout with a fake signed-in user.
// import.meta.env.DEV is false in production builds, so this code is removed there.
if (import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === 'shell') {
  import('./dev/ShellPreview.jsx').then(({ default: ShellPreview }) => root.render(<ShellPreview />));
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
