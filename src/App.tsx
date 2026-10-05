import { FileText, Sparkles, Upload, X } from 'lucide-react'
import './App.css'
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const loadingMessages = [
  'Analysing... 👀',
  'Reading real quick... ',
  'Cooking... ',
  'Putting it together... 🧩',
  'Almost there...',
]

type Status = 'idle' | 'uploading' | 'ready'
type Message = { q: string; a: string }

const getErrorMessage = (data: any, fallback: string): string =>
  typeof data?.detail === 'string' ? data.detail : fallback

function App() {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0])
  const [asking, setAsking] = useState(false)
  const [paperId, setPaperId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [uploadError, setUploadError] = useState('')
  const [queryError, setQueryError] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking, queryError])

  const validateAndSetFile = (selected: File | undefined) => {
    if (!selected) return
    if (selected.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.')
      return
    }
    if (selected.size > MAX_SIZE) {
      setUploadError('File is too large. Maximum size is 10 MB.')
      return
    }
    setUploadError('')
    setFile(selected)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    validateAndSetFile(e.dataTransfer.files?.[0])
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(e.target.files?.[0])
    e.target.value = ''
  }

  const removeFile = () => {
    setFile(null)
    setStatus('idle')
    setPaperId(null)
    setQuestion('')
    setMessages([])
    setUploadError('')
    setQueryError('')
  }

  const handleUpload = async () => {
    if (!file) return

    setStatus('uploading')
    setUploadError('')
    setQueryError('')
    setMessages([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadPromise = fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      })

      // Show every loading message for 2.5 seconds
      for (let i = 0; i < loadingMessages.length; i++) {
        setLoadingMessage(loadingMessages[i])

        await new Promise((resolve) => {
          setTimeout(resolve, 2500)
        })
      }

      const res = await uploadPromise
      const data = await res.json()

      if (!res.ok) {
        throw new Error(getErrorMessage(data, 'Upload failed'))
      }

      setPaperId(data.paper_id)
      setStatus('ready')
    } catch (err) {
      setStatus('idle')
      setUploadError(
        err instanceof Error ? err.message : 'Something went wrong'
      )
    }
  }
  const handleAsk = async () => {
    const q = question.trim()
    if (!paperId || !q || asking) return
    setAsking(true)
    setQueryError('')

    try {
      const res = await fetch(`${API_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_id: paperId, question: q }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(getErrorMessage(data, 'Query failed'))

      setMessages((prev) => [...prev, { q, a: data.answer }])
      setQuestion('')
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setAsking(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  const showPanel = status !== 'idle'

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative">
        <h1 className="text-primary text-3xl md:text-4xl font-bold text-center">
          Ask questions about your PDF and get simple, <br className="hidden md:block" />
          accurate answers with AI.
        </h1>

        <div className="flex flex-col lg:flex-row gap-5 mt-10 w-full max-w-6xl items-center lg:items-start justify-center">
          {/* left */}
          <div className="flex items-center justify-center flex-col w-full lg:w-auto">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleInputChange}
            />
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border flex items-center flex-col justify-center h-80 border-dashed w-full lg:w-135 rounded-xl space-y-2 cursor-pointer transition-colors duration-200 px-4
                ${isDragging ? 'border-2 border-primary bg-primary/10' : 'border-primary'}`}
            >
              {file ? (
                <div className="flex items-center gap-3 text-white max-w-full">
                  <FileText size={42} strokeWidth={1.5} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xl max-w-60 sm:max-w-80 truncate">{file.name}</p>
                    <p className="text-sm opacity-70">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile()
                    }}
                    aria-label="Remove file"
                    className="ml-2 cursor-pointer hover:text-red-400"
                  >
                    <X size={22} />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-white text-2xl text-center">
                    {isDragging ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
                  </p>
                  <p className="text-white text-md">Maximum file size: 10 MB</p>
                  <Upload size={42} strokeWidth={1.5} className="text-white mt-2" />
                </>
              )}
            </div>

            {uploadError && <p className="text-red-400 mt-3 text-center">{uploadError}</p>}

            {!showPanel && (
              <button
                onClick={handleUpload}
                disabled={!file}
                className="mt-8 px-12 cursor-pointer font-medium text-md rounded-lg py-2.5 bg-dark hover:bg-darkprimary text-white transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload
              </button>
            )}
          </div>

          {/* right */}
          {showPanel && (
            <div className="text-white flex items-center justify-center w-full lg:w-145 h-135 max-h-[80vh] rounded-xl border border-primary p-6 sm:p-8 shadow-2xl">
              {status === 'ready' ? (
                <div className="flex flex-col gap-4 w-full h-full">
                  {/* chat history */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
                    {messages.length === 0 && !asking && !queryError && (
                      <p className="text-white/60 text-center mt-8">
                        Your PDF is ready. Ask your first question below.
                      </p>
                    )}

                    {messages.map((m, i) => (
                      <div key={i} className="space-y-2">
                        <p className="text-primary font-medium whitespace-pre-wrap">{m.q}</p>
                        <div className="text-white">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {m.a}
                          </ReactMarkdown>
                        </div>

                      </div>
                    ))}

                    {asking && <p className="animate-pulse text-white/80">Thinking...</p>}
                    {queryError && <p className="text-red-400">{queryError}</p>}
                    <div ref={chatEndRef} />
                  </div>

                  {/* input */}
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-xl border border-primary/75 px-4 py-3 text-white
                      placeholder:text-white/70 resize-none
                      focus:border-2 focus:border-primary focus:outline-none"
                    rows={3}
                    placeholder="What do you want to know about your PDF?"
                  />

                  <button
                    type="button"
                    onClick={handleAsk}
                    disabled={asking || !question.trim()}
                    className="group self-center flex items-center justify-center gap-3
                      border border-primary px-4 py-1.5
                      text-primary transition-colors duration-300 rounded-lg
                      hover:bg-darkprimary cursor-pointer font-medium hover:text-white
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {asking ? 'Asking...' : 'Ask AI'}
                    <Sparkles className="text-primary w-5 h-5 transition-colors group-hover:text-white animate-pulse" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-10 h-10 border-4 border-primary rounded-full border-t-transparent animate-spin [animation-duration:1.5s]" />
                  <p className="mt-4 font-medium animate-pulse">{loadingMessage}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="absolute bottom-5 text-white/60 text-sm text-center">
          Made with ❤️ by Raifa
        </p>
      </div>

    </>

  )
}

export default App