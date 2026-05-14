import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import StationPage from './pages/StationPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/station" element={<StationPage />} />
        <Route path="/" element={<Navigate to="/station" replace />} />
        <Route path="*" element={<Navigate to="/station" replace />} />
      </Routes>
    </BrowserRouter>
  )
}