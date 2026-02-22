import { FileText, FileSpreadsheet, FileJson, Check, Loader, AlertCircle } from 'lucide-react'
import type { UploadedFile } from '../types'

interface FileListProps {
  files: UploadedFile[]
}

function getFileIcon(type: string) {
  switch (type) {
    case 'csv':
    case 'xlsx':
      return <FileSpreadsheet size={18} />
    case 'json':
      return <FileJson size={18} />
    default:
      return <FileText size={18} />
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileList({ files }: FileListProps) {
  if (files.length === 0) return null

  return (
    <div className="file-list">
      <h3 className="file-list__title">Uploaded Files</h3>
      <div className="file-list__items">
        {files.map((file, idx) => (
          <div key={idx} className={`file-item file-item--${file.status}`}>
            <div className="file-item__icon">{getFileIcon(file.type)}</div>
            <div className="file-item__info">
              <span className="file-item__name" title={file.name}>
                {file.name}
              </span>
              <span className="file-item__meta">
                {formatSize(file.size)}
                {file.status === 'done' && ` · ${file.documents} pages`}
              </span>
            </div>
            <div className="file-item__status">
              {file.status === 'uploading' && (
                <div className="file-item__progress-ring">
                  <Loader size={18} className="spin" />
                  <span className="file-item__percent">{file.progress}%</span>
                </div>
              )}
              {file.status === 'processing' && <Loader size={18} className="spin" />}
              {file.status === 'done' && <Check size={18} className="file-item__check" />}
              {file.status === 'error' && <AlertCircle size={18} className="file-item__error-icon" />}
            </div>
            {file.status === 'uploading' && (
              <div className="file-item__progress-bar">
                <div
                  className="file-item__progress-fill"
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            )}
            {file.status === 'error' && file.error && (
              <div className="file-item__error">{file.error}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
