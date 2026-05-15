// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom'

const rolePermissions = {
  admin: ['/admin/display', '/admin/manage', '/station'],
  editor: ['/admin/manage'],
  leader: ['/admin/display'],
  op: ['/station']
}

export default function ProtectedRoute({ children, user, allowedRoles }) {
  if (!user) {
    return <Navigate to="/" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate page based on role
    const userPermissions = rolePermissions[user.role] || []
    if (userPermissions.length > 0) {
      return <Navigate to={userPermissions[0]} replace />
    }
    return <Navigate to="/" replace />
  }

  return children
}