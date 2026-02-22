export interface Source {
  chunk_id: number
  source_file: string
  page: number
  distance: number
  text_preview: string
  chunk_type: 'text' | 'table' | 'figure'
  asset_url: string
  section: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: Source[]
  status: 'streaming' | 'complete' | 'no_context' | 'error'
  query?: string
}

export interface UploadedFile {
  name: string
  size: number
  type: string
  documents: number
  status: 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  error?: string
}
