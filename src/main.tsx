import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider as NextThemesProvider} from 'next-themes';
import App from './App.tsx';
import './index.css';

// Workaround for next-themes type mismatch in React 19
const ThemeProvider = NextThemesProvider as any;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
