import { useState, useCallback } from 'react'
import { UploadZone } from './UploadZone'
import { FileList } from './FileList'
import type { UploadedFile } from '../types'

interface UploadPanelProps {
  sessionId: string | null
}

const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10 MB
const MAX_FILES = 5

export function UploadPanel({ sessionId }: UploadPanelProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])

  const uploadFile = useCallback(
    (file: File) => {
      if (!sessionId) return

      // Client-side file size validation
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
        const entry: UploadedFile = {
          name: file.name,
          size: file.size,
          type: file.name.split('.').pop() || 'unknown',
          documents: 0,
          status: 'error',
          progress: 0,
          error: `File too large (${sizeMB} MB). Maximum is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`,
        }
        setFiles((prev) => [...prev, entry])
        return
      }

      const entry: UploadedFile = {
        name: file.name,
        size: file.size,
        type: file.name.split('.').pop() || 'unknown',
        documents: 0,
        status: 'uploading',
        progress: 0,
      }

      setFiles((prev) => [...prev, entry])
      const fileIndex = files.length

      const formData = new FormData()
      formData.append('file', file)
      formData.append('session_id', sessionId)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100)
          setFiles((prev) =>
            prev.map((f, i) =>
              i === fileIndex ? { ...f, progress: pct, status: pct >= 100 ? 'processing' : 'uploading' } : f
            )
          )
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText)
          setFiles((prev) =>
            prev.map((f, i) =>
              i === fileIndex
                ? { ...f, status: 'done', progress: 100, documents: data.documents_loaded }
                : f
            )
          )
        } else {
          let errorMsg = 'Upload failed'
          try {
            const data = JSON.parse(xhr.responseText)
            errorMsg = data.detail || errorMsg
          } catch { /* ignore */ }
          setFiles((prev) =>
            prev.map((f, i) =>
              i === fileIndex ? { ...f, status: 'error', error: errorMsg } : f
            )
          )
        }
      })

      xhr.addEventListener('error', () => {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === fileIndex ? { ...f, status: 'error', error: 'Network error' } : f
          )
        )
      })

      xhr.open('POST', '/api/upload')
      xhr.send(formData)
    },
    [sessionId, files.length]
  )

  const handleFilesSelected = useCallback(
    (fileList: FileList) => {
      const currentCount = files.filter((f) => f.status !== 'error').length
      const incoming = Array.from(fileList)

      if (currentCount + incoming.length > MAX_FILES) {
        const allowed = MAX_FILES - currentCount
        if (allowed <= 0) {
          // Add error entries for all rejected files
          const errorEntries: UploadedFile[] = incoming.map((file) => ({
            name: file.name,
            size: file.size,
            type: file.name.split('.').pop() || 'unknown',
            documents: 0,
            status: 'error' as const,
            progress: 0,
            error: `Maximum ${MAX_FILES} files per session reached.`,
          }))
          setFiles((prev) => [...prev, ...errorEntries])
          return
        }
        // Upload only what's allowed, error the rest
        incoming.slice(0, allowed).forEach(uploadFile)
        incoming.slice(allowed).forEach((file) => {
          const entry: UploadedFile = {
            name: file.name,
            size: file.size,
            type: file.name.split('.').pop() || 'unknown',
            documents: 0,
            status: 'error',
            progress: 0,
            error: `Maximum ${MAX_FILES} files per session. This file was not uploaded.`,
          }
          setFiles((prev) => [...prev, entry])
        })
        return
      }

      incoming.forEach(uploadFile)
    },
    [uploadFile, files]
  )

  const hasFiles = files.length > 0
  const readyCount = files.filter((f) => f.status === 'done').length
  const activeCount = files.filter((f) => f.status !== 'error').length

  return (
    <aside className="upload-panel">
      <div className="upload-panel__header">
        <h2 className="upload-panel__title">Documents</h2>
        {readyCount > 0 && (
          <span className="upload-panel__badge">{readyCount} ready</span>
        )}
      </div>

      <UploadZone onFilesSelected={handleFilesSelected} disabled={!sessionId || activeCount >= MAX_FILES} />

      {activeCount >= MAX_FILES && (
        <p className="upload-panel__limit-msg">
          File limit reached ({MAX_FILES}/{MAX_FILES})
        </p>
      )}

      <FileList files={files} />

      {!hasFiles && (
        <div className="upload-panel__hint">
          <p>Upload your documents to get started. You can ask questions about them in the chat.</p>
          <p className="upload-panel__limits-info">Max {MAX_FILE_SIZE / (1024 * 1024)} MB per file · Up to {MAX_FILES} files</p>
        </div>
      )}
    </aside>
  )
}
