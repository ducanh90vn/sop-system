// src/pages/StationPage.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Worker, Viewer } from '@react-pdf-viewer/core'
import '@react-pdf-viewer/core/lib/styles/index.css'

export default function StationPage() {
  const [myPosition, setMyPosition] = useState(null)  // do người dùng chọn
  const [pdfUrl, setPdfUrl] = useState(null)
  const [activeModelId, setActiveModelId] = useState(null)
  const [positionCount, setPositionCount] = useState(0)  // số lượng vị trí của model

  // Lấy số lượng vị trí của model
  const loadPositionCount = async (modelId) => {
    if (!modelId) return
    const { data } = await supabase
      .from('positions')
      .select('position_number')
      .eq('model_id', modelId)
    
    if (data && data.length > 0) {
      const maxPosition = Math.max(...data.map(d => d.position_number))
      setPositionCount(maxPosition)
    } else {
      setPositionCount(0)
    }
  }

  // Khi position hoặc model thay đổi → tải PDF tương ứng
  const loadPDF = async (modelId, position) => {
    if (!modelId || !position) return
    const { data } = await supabase
      .from('positions')
      .select('pdf_url')
      .eq('model_id', modelId)
      .eq('position_number', position)
      .single()
    setPdfUrl(data?.pdf_url || null)
  }

  // Lắng nghe Realtime: khi Admin đổi model
  useEffect(() => {
    // Tải trạng thái hiện tại ngay khi mở
    supabase.from('app_state').select('active_model_id').eq('id', 1).single()
      .then(({ data }) => {
        setActiveModelId(data.active_model_id)
        loadPositionCount(data.active_model_id)
        loadPDF(data.active_model_id, myPosition)
      })

    // Subscribe realtime channel
    const channel = supabase
      .channel('app_state_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_state'
      }, (payload) => {
        const newModelId = payload.new.active_model_id
        setActiveModelId(newModelId)
        loadPositionCount(newModelId)
        loadPDF(newModelId, myPosition)  // dùng myPosition hiện tại
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [myPosition]) // re-subscribe khi position thay đổi

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Chọn vị trí */}
      {!myPosition ? (
        <div style={{ padding: 40 }}>
          <h2>Chọn vị trí của trạm này:</h2>
          {Array.from({ length: positionCount }, (_, i) => i + 1).map(pos => (
            <button key={pos} onClick={() => setMyPosition(pos)}
              style={{ margin: 8, padding: '12px 24px', fontSize: 18 }}>
              Vị trí {pos}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div style={{ padding: '8px 16px', background: '#f5f5f5', display: 'flex', gap: 16 }}>
            <span>Trạm: <b>Vị trí {myPosition}</b></span>
            <button onClick={() => setMyPosition(null)}>Đổi vị trí</button>
          </div>

          {pdfUrl ? (
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
              <div style={{ flex: 1 }}>
                <Viewer fileUrl={pdfUrl} />
              </div>
            </Worker>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p>Chưa có PDF cho vị trí này. Đợi Admin chọn model...</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}