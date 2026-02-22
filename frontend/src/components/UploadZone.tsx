import { useState, useRef, useCallback } from 'react'
import { Upload, FileUp } from 'lucide-react'

interface UploadZoneProps {
  onFilesSelected: (files: FileList) => void
  disabled?: boolean
}

const ACCEPTED = '.pdf,.txt,.csv,.xlsx,.docx,.json'

export function UploadZone({ onFilesSelected, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (!disabled && e.dataTransfer.files.length > 0) {
        onFilesSelected(e.dataTransfer.files)
      }
    },
    [disabled, onFilesSelected]
  )

  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <div
      className={`upload-zone ${isDragging ? 'upload-zone--dragging' : ''} ${disabled ? 'upload-zone--disabled' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <div className="upload-zone__icon">
        {isDragging ? <FileUp size={32} /> : <Upload size={32} />}
      </div>
      <p className="upload-zone__text">
        {isDragging ? 'Drop files here' : 'Drag & drop files here'}
      </p>
      <p className="upload-zone__subtext">
        or <span className="upload-zone__browse">browse</span>
      </p>
      <p className="upload-zone__formats">
        PDF, TXT, CSV, XLSX, DOCX, JSON
      </p>
    </div>
  )
}
