import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './Root';
import './styles.css';
import { installModuleRecovery } from './lib/module-recovery';
installModuleRecovery();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
