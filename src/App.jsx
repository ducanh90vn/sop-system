import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import DisplayModelPage from './pages/DisplayModelPage'
import ManageModelPage from './pages/ManageModelPage'
import StationPage from './pages/StationPage'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div>Đang tải...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            user ? <Navigate to={getDefaultRoute(user.role)} replace /> : <LoginPage onLogin={handleLogin} />
          }
        />

        <Route
          path="/admin/display"
          element={
            <ProtectedRoute user={user} allowedRoles={['admin', 'leader']}>
              <DisplayModelPage onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/manage"
          element={
            <ProtectedRoute user={user} allowedRoles={['admin', 'editor']}>
              <ManageModelPage onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/station"
          element={
            <ProtectedRoute user={user} allowedRoles={['admin', 'op']}>
              <StationPage onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function getDefaultRoute(role) {
  switch (role) {
    case 'admin':
      return '/admin/display'
    case 'editor':
      return '/admin/manage'
    case 'leader':
      return '/admin/display'
    case 'op':
      return '/station'
    default:
      return '/'
  }
}