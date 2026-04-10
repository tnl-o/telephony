import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

/* StrictMode отключён: двойной mount ломал SIP (повторный connect/stop UA), INVITE не уходил на FreeSWITCH. */
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
