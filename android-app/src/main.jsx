import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/urbanist/400.css';
import '@fontsource/urbanist/600.css';
import '@fontsource/urbanist/700.css';
import '@fontsource/urbanist/800.css';
import './styles.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
