// src/pages/DisplayModelPage.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function DisplayModelPage({ onLogout }) {
  const [models, setModels] = useState([])
  const [activeModelId, setActiveModelId] = useState('')
  const [message, setMessage] = useState({ text: '', type: '' })

  useEffect(() => {
    fetchModels()
    fetchAppState()
  }, [])

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 4000)
  }

  const fetchModels = async () => {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .order('created_at')
    if (error) showMessage('Lỗi tải models: ' + error.message, 'error')
    else setModels(data || [])
  }

  const fetchAppState = async () => {
    const { data } = await supabase
      .from('app_state')
      .select('active_model_id')
      .eq('id', 1)
      .single()
    if (data?.active_model_id) setActiveModelId(data.active_model_id)
  }

  const handleSelectModel = async (modelId) => {
    setActiveModelId(modelId)
    const { error } = await supabase
      .from('app_state')
      .update({ active_model_id: modelId, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) {
      showMessage('Lỗi cập nhật: ' + error.message, 'error')
    } else {
      const name = models.find(m => m.id === modelId)?.name
      showMessage(`✅ Đang hiển thị: ${name} — tất cả trạm đã nhận lệnh`, 'success')
    }
  }

  const msgBg     = { success: '#f0fdf4', error: '#fff1f2', info: '#eff6ff' }
  const msgColor  = { success: '#166534', error: '#9f1239', info: '#1e40af' }
  const msgBorder = { success: '#bbf7d0', error: '#fecdd3', info: '#bfdbfe' }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: '100vh', background: '#f8fafc' }}>

      {/* Header */}
      <div style={{ background: '#1e293b', color: '#fff', padding: '16px 32px', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>📺 Chọn Model Hiển Thị</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/admin/manage" style={{
            padding: '8px 16px', background: '#475569', color: '#fff',
            borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 500
          }}>
            → Quản lý Model & PDF
          </Link>
          <button
            onClick={onLogout}
            style={{
              padding: '8px 16px', background: '#dc2626', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Toast */}
      {message.text && (
        <div style={{
          margin: '16px 32px 0', padding: '10px 16px',
          background: msgBg[message.type], border: `1px solid ${msgBorder[message.type]}`,
          borderRadius: 8, color: msgColor[message.type], fontSize: 14
        }}>
          {message.text}
        </div>
      )}

      <div style={{ padding: '24px 32px', maxWidth: 800 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#1e293b' }}>Chọn model đang hiển thị tại tất cả máy trạm</h2>
        <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>
          Khi chọn, tất cả máy trạm sẽ nhận lệnh qua Realtime và tải PDF tương ứng.
        </p>
        {models.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
            Chưa có model nào. <Link to="/admin/manage" style={{ color: '#2563eb', textDecoration: 'underline' }}>Vào đây</Link> để thêm model.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {models.map(m => {
              const isActive = activeModelId === m.id
              return (
                <button key={m.id} onClick={() => handleSelectModel(m.id)} style={{
                  padding: '16px 20px', borderRadius: 10,
                  border: isActive ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                  background: isActive ? '#eff6ff' : '#fff',
                  color: isActive ? '#1d4ed8' : '#334155',
                  fontWeight: isActive ? 700 : 400,
                  fontSize: 15, cursor: 'pointer', textAlign: 'left',
                  boxShadow: isActive ? '0 0 0 4px #dbeafe' : 'none',
                  transition: 'all 0.15s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: isActive ? '#2563eb' : '#cbd5e1', flexShrink: 0
                    }} />
                    <span>{m.name}</span>
                    {isActive && (
                      <span style={{ marginLeft: 'auto', fontSize: 11, background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: 20 }}>
                        Đang bật
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: isActive ? '#3b82f6' : '#94a3b8', paddingLeft: 18 }}>
                    {m.num_positions || 4} vị trí
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
