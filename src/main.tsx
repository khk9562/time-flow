import { createRoot } from 'react-dom/client';
import './global.css';
import { App } from './App';
import { registerFonts } from './lib/fonts';

registerFonts();

createRoot(document.getElementById('root')!).render(<App />);
