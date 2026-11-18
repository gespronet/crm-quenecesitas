import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App, { CSS } from './App';
import { FirmaPublica, VerificarDni } from './Firma';
import { ActivarCuenta } from './Cuenta';
import reportWebVitals from './reportWebVitals';

const qs = new URLSearchParams(window.location.search);
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {qs.get('firmar') ? <FirmaPublica token={qs.get('firmar')} css={CSS} />
      : qs.get('verificar_dni') ? <VerificarDni vtoken={qs.get('verificar_dni')} css={CSS} />
      : qs.get('activar') ? <ActivarCuenta token={qs.get('activar')} css={CSS} />
      : <App />}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
