import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import CapturesPage from './CapturesPage.jsx';
import './styles.css';

let view = '';
try { view = new URLSearchParams(location.search).get('view') || ''; } catch { /* ignore */ }

const Root = view === 'captures' ? CapturesPage : App;
createRoot(document.getElementById('root')).render(<Root />);
