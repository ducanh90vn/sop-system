import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('display')

  // --- Shared ---
  const [models, setModels] = useState([])
  const [message, setMessage] = useState({ text: '', type: '' })

  // --- Tab 1 ---
  const [activeModelId, setActiveModelId] = useState('')

  // --- Tab 2: Model ---
  const [newModelName, setNewModelName] = useState('')
  const [newModelPositions, setNewModelPositions] = useState(4)
  const [editingModel, setEditingModel] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPositions, setEditPositions] = useState(4)

  // --- Tab 2: Upload ---
  const [selectedModelForUpload, setSelectedModelForUpload] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState({})
  const [existingPDFs, setExistingPDFs] = useState([])

  useEffect(() => {
    fetchModels()
    fetchAppState()
  }, [])

  useEffect(() => {
    if (selectedModelForUpload) fetchExistingPDFs(selectedModelForUpload)
    else setExistingPDFs([])
  }, [selectedModelForUpload])

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

  const fetchExistingPDFs = async (modelId) => {
    const { data } = await supabase
      .from('positions')
      .select('position_number, pdf_url')
      .eq('model_id', modelId)
      .order('position_number')
    setExistingPDFs(data || [])
  }

  // TAB 1
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

  // TAB 2: Thêm model
  const handleAddModel = async () => {
    if (!newModelName.trim()) return
    const num = Math.max(1, Math.min(99, parseInt(newModelPositions) || 4))
    const { error } = await supabase
      .from('models')
      .insert({ name: newModelName.trim(), num_positions: num })
    if (error) {
      showMessage('Lỗi thêm model: ' + error.message, 'error')
    } else {
      showMessage(`✅ Đã thêm: ${newModelName} (${num} vị trí)`, 'success')
      setNewModelName('')
      setNewModelPositions(4)
      fetchModels()
    }
  }

  // TAB 2: Sửa model
  const handleEditModel = (model) => {
    setEditingModel(model)
    setEditName(model.name)
    setEditPositions(model.num_positions || 4)
  }

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editingModel) return
    const num = Math.max(1, Math.min(99, parseInt(editPositions) || 4))
    const { error } = await supabase
      .from('models')
      .update({ name: editName.trim(), num_positions: num })
      .eq('id', editingModel.id)
    if (error) {
      showMessage('Lỗi cập nhật: ' + error.message, 'error')
    } else {
      showMessage(`✅ Đã cập nhật: ${editName} (${num} vị trí)`, 'success')
      setEditingModel(null)
      fetchModels()
    }
  }

  // TAB 2: Xóa model
  const handleDeleteModel = async (modelId, modelName) => {
    if (!window.confirm(`Xóa model "${modelName}"? Tất cả PDF liên quan cũng sẽ bị xóa.`)) return
    const { error } = await supabase.from('models').delete().eq('id', modelId)
    if (error) {
      showMessage('Lỗi xóa: ' + error.message, 'error')
    } else {
      showMessage(`🗑️ Đã xóa: ${modelName}`, 'info')
      fetchModels()
      if (selectedModelForUpload === modelId) setSelectedModelForUpload('')
    }
  }

  // TAB 2: Upload PDF
  const handleUploadPDF = async (positionNumber, file) => {
    if (!selectedModelForUpload) return
    setUploading(true)
    setUploadStatus(prev => ({ ...prev, [positionNumber]: 'uploading' }))

    const path = `${selectedModelForUpload}/position_${positionNumber}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('sop-files')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      showMessage('Lỗi upload: ' + uploadError.message, 'error')
      setUploadStatus(prev => ({ ...prev, [positionNumber]: 'error' }))
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('sop-files').getPublicUrl(path)

    const { error: dbError } = await supabase
      .from('positions')
      .upsert(
        { model_id: selectedModelForUpload, position_number: positionNumber, pdf_url: publicUrl },
        { onConflict: 'model_id,position_number' }
      )

    if (dbError) {
      showMessage('Lỗi lưu DB: ' + dbError.message, 'error')
      setUploadStatus(prev => ({ ...prev, [positionNumber]: 'error' }))
    } else {
      showMessage(`✅ Upload vị trí ${positionNumber} thành công!`, 'success')
      setUploadStatus(prev => ({ ...prev, [positionNumber]: 'done' }))
      fetchExistingPDFs(selectedModelForUpload)
    }
    setUploading(false)
  }

  // Helpers
  const getPDFStatus = (pos) => existingPDFs.find(p => p.position_number === pos)
  const selectedModelData = models.find(m => m.id === selectedModelForUpload)
  const positionCount = selectedModelData?.num_positions || 4
  const positionList = Array.from({ length: positionCount }, (_, i) => i + 1)

  const msgBg     = { success: '#f0fdf4', error: '#fff1f2', info: '#eff6ff' }
  const msgColor  = { success: '#166534', error: '#9f1239', info: '#1e40af' }
  const msgBorder = { success: '#bbf7d0', error: '#fecdd3', info: '#bfdbfe' }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: '100vh', background: '#f8fafc' }}>

      {/* Header */}
      <div style={{ background: '#1e293b', color: '#fff', padding: '16px 32px', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 700 }}>⚙️ SOP Admin</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#94a3b8' }}>Hệ thống quản lý SOP</span>
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

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', margin: '24px 32px 0', gap: 4 }}>
        {[
          { key: 'display', label: '📺  Chọn model hiển thị' },
          { key: 'manage',  label: '🗂️  Quản lý model & PDF' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '10px 24px', fontSize: 14,
            fontWeight: activeTab === tab.key ? 600 : 400,
            background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -2,
            color: activeTab === tab.key ? '#2563eb' : '#64748b',
            cursor: 'pointer', borderRadius: '6px 6px 0 0'
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 760 }}>

        {/* ══ TAB 1 ══ */}
        {activeTab === 'display' && (
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#1e293b' }}>Chọn model đang hiển thị tại tất cả máy trạm</h2>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>
              Khi chọn, tất cả máy trạm sẽ nhận lệnh qua Realtime và tải PDF tương ứng.
            </p>
            {models.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
                Chưa có model nào. Vào tab <b>Quản lý</b> để thêm model.
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
        )}

        {/* ══ TAB 2 ══ */}
        {activeTab === 'manage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* A: Thêm model */}
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#1e293b' }}>➕ Thêm model mới</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Tên model</label>
                  <input
                    type="text"
                    placeholder="Galaxy S24, iPhone 15..."
                    value={newModelName}
                    onChange={e => setNewModelName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddModel()}
                    style={{
                      width: '100%', padding: '9px 14px', fontSize: 14,
                      borderRadius: 8, border: '1.5px solid #e2e8f0',
                      outline: 'none', background: '#fff', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ width: 130 }}>
                  <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>Số vị trí</label>
                  <input
                    type="number" min="1" max="99"
                    value={newModelPositions}
                    onChange={e => setNewModelPositions(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 14px', fontSize: 14,
                      borderRadius: 8, border: '1.5px solid #e2e8f0',
                      outline: 'none', background: '#fff', boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  onClick={handleAddModel}
                  disabled={!newModelName.trim()}
                  style={{
                    padding: '9px 22px', height: 40,
                    background: newModelName.trim() ? '#2563eb' : '#94a3b8',
                    color: '#fff', border: 'none', borderRadius: 8,
                    cursor: newModelName.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap'
                  }}
                >
                  Thêm
                </button>
              </div>
            </section>

            {/* B: Danh sách model */}
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#1e293b' }}>📋 Danh sách model</h2>
              {models.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>Chưa có model nào.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {models.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', border: '1.5px solid #e2e8f0',
                      borderRadius: 8, background: '#fff'
                    }}>
                      {editingModel?.id === m.id ? (
                        <>
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                            autoFocus
                            placeholder="Tên model"
                            style={{
                              flex: 1, padding: '6px 10px', fontSize: 14,
                              borderRadius: 6, border: '1.5px solid #2563eb', outline: 'none'
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <label style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>Số vị trí:</label>
                            <input
                              type="number" min="1" max="99"
                              value={editPositions}
                              onChange={e => setEditPositions(e.target.value)}
                              style={{
                                width: 64, padding: '6px 8px', fontSize: 14,
                                borderRadius: 6, border: '1.5px solid #2563eb',
                                outline: 'none', textAlign: 'center'
                              }}
                            />
                          </div>
                          <button onClick={handleSaveEdit} style={btnStyle('#2563eb')}>Lưu</button>
                          <button onClick={() => setEditingModel(null)} style={btnStyle('#64748b')}>Hủy</button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontSize: 14, color: '#334155', fontWeight: 500 }}>{m.name}</span>
                          <span style={{
                            fontSize: 12, color: '#64748b', background: '#f1f5f9',
                            padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap'
                          }}>
                            {m.num_positions || 4} vị trí
                          </span>
                          {activeModelId === m.id && (
                            <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20 }}>
                              Đang hiển thị
                            </span>
                          )}
                          <button onClick={() => handleEditModel(m)} style={btnStyle('#475569')}>✏️ Sửa</button>
                          <button onClick={() => handleDeleteModel(m.id, m.name)} style={btnStyle('#dc2626')}>🗑️ Xóa</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* C: Upload PDF */}
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#1e293b' }}>📄 Upload SOP PDF theo vị trí</h2>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: '#475569', display: 'block', marginBottom: 6 }}>Chọn model:</label>
                <select
                  value={selectedModelForUpload}
                  onChange={e => { setSelectedModelForUpload(e.target.value); setUploadStatus({}) }}
                  style={{
                    padding: '9px 14px', fontSize: 14, borderRadius: 8,
                    border: '1.5px solid #e2e8f0', background: '#fff',
                    width: '100%', outline: 'none'
                  }}
                >
                  <option value="">-- Chọn model --</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.num_positions || 4} vị trí)</option>
                  ))}
                </select>
              </div>

              {!selectedModelForUpload ? (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>← Chọn model ở trên để bắt đầu upload</p>
              ) : (
                <>
                  <div style={{
                    marginBottom: 12, padding: '8px 14px',
                    background: '#eff6ff', borderRadius: 8,
                    fontSize: 13, color: '#1d4ed8', border: '1px solid #bfdbfe'
                  }}>
                    Model <b>{selectedModelData?.name}</b> có <b>{positionCount} vị trí</b>.
                    Để thay đổi số vị trí → mục <b>Danh sách model → ✏️ Sửa</b>.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {positionList.map(pos => {
                      const existing = getPDFStatus(pos)
                      const status = uploadStatus[pos]
                      return (
                        <div key={pos} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 16px', border: '1.5px solid #e2e8f0',
                          borderRadius: 8, background: '#fff'
                        }}>
                          <span style={{ minWidth: 80, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                            Vị trí {pos}
                          </span>
                          <span style={{ flex: 1, fontSize: 12, color: '#64748b' }}>
                            {status === 'uploading' && '⏳ Đang upload...'}
                            {status === 'done'      && '✅ Đã upload xong'}
                            {status === 'error'     && '❌ Lỗi upload'}
                            {!status && existing && (
                              <span style={{ color: '#16a34a' }}>
                                ✅ Có PDF &nbsp;
                                <a href={existing.pdf_url} target="_blank" rel="noreferrer"
                                  style={{ color: '#2563eb', textDecoration: 'underline' }}>Xem</a>
                              </span>
                            )}
                            {!status && !existing && <span style={{ color: '#94a3b8' }}>Chưa có PDF</span>}
                          </span>
                          <label style={{
                            padding: '6px 14px', background: '#f1f5f9',
                            border: '1.5px solid #e2e8f0', borderRadius: 6,
                            fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer',
                            color: '#475569', fontWeight: 500, whiteSpace: 'nowrap'
                          }}>
                            {existing ? '🔄 Cập nhật PDF' : '📤 Upload PDF'}
                            <input
                              type="file" accept="application/pdf"
                              disabled={uploading}
                              style={{ display: 'none' }}
                              onChange={e => {
                                if (e.target.files[0]) handleUploadPDF(pos, e.target.files[0])
                                e.target.value = ''
                              }}
                            />
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg) {
  return {
    padding: '5px 12px', background: bg, color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer',
    fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap'
  }
}