import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { verbind } from './lib/dataStore';
import { startSyntessKoppeling } from './syntess/syStore';
import './styles.css';

verbind();
startSyntessKoppeling();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
