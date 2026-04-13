'use client'

import { useState } from 'react'
import { HardHat, FileText, Upload, Check, Clock, ChevronDown, ChevronUp, Building2, FolderOpen, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Project {
  id: string
  name: string
  description: string | null
  project_number: string | null
  due_date: string | null
  is_published: boolean
}

interface Subcontractor {
  id: string
  project_id: string
  csi_division: string
  csi_code: string | null
  vendor_name: string | null
  document_types: string[]
}

interface Document {
  id: string
  project_id: string
  subcontractor_id: string
  document_type: string
  status: string
  file_url: string
  uploaded_at: string
  approved_at: string | null
}

interface ClientPortalClientProps {
  project: Project
  subcontractors: Subcontractor[]
  documents: Document[]
  token: string
}

export default function ClientPortalClient({
  project,
  subcontractors: initialSubcontractors,
  documents: initialDocuments,
  token,
}: ClientPortalClientProps) {
  const router = useRouter()
  const [subcontractors] = useState(initialSubcontractors)
  const [documents, setDocuments] = useState(initialDocuments)
  const [viewMode, setViewMode] = useState<'bySubcontractor' | 'byDocumentType'>('bySubcontractor')
  // All items expanded by default like the cloned repo
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(new Set())
  const [collapsedDocTypes, setCollapsedDocTypes] = useState<Set<string>>(new Set())
  
  const toggleSub = (id: string) => {
    setCollapsedSubs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  
  const toggleDocType = (docType: string) => {
    setCollapsedDocTypes(prev => {
      const next = new Set(prev)
      if (next.has(docType)) next.delete(docType)
      else next.add(docType)
      return next
    })
  }
  const [uploading, setUploading] = useState<string | null>(null)

  // Calculate overall progress
  const totalDocs = subcontractors.reduce((acc, sub) => acc + (sub.document_types?.length || 0), 0)
  const approvedDocs = documents.filter((d) => d.status === 'approved').length
  const completionPercent = totalDocs > 0 ? Math.round((approvedDocs / totalDocs) * 100) : 0

  // Get all unique document types across all subcontractors
  const allDocumentTypes = Array.from(
    new Set(subcontractors.flatMap((sub) => sub.document_types || []))
  ).sort()

  const handleUpload = async (subcontractorId: string, documentType: string, file: File) => {
    setUploading(`${subcontractorId}-${documentType}`)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', project.id)
      formData.append('subcontractorId', subcontractorId)
      formData.append('documentType', documentType)

      const res = await fetch('/api/upload-document', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      const { document } = await res.json()
      setDocuments((prev) => [...prev, document])
      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload document')
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 text-sm opacity-80 mb-2">
            <Building2 className="w-4 h-4" />
            CLOSEOUT PACKAGE
          </div>
          <h1 className="text-3xl font-display font-bold">{project.name}</h1>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-primary/90 text-primary-foreground">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="bg-primary-foreground/10 rounded-xl p-4 backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">Overall Completion</span>
              <div className="flex items-center gap-6">
                <span className="text-2xl font-bold">{completionPercent}%</span>
                <div className="text-right">
                  <div className="text-2xl font-bold">{approvedDocs}</div>
                  <div className="text-xs opacity-80">DOCS APPROVED</div>
                </div>
              </div>
            </div>
            <div className="w-full bg-primary-foreground/20 rounded-full h-2">
              <div
                className="bg-green-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* View Mode Tabs */}
        <div className="flex gap-4 mb-6 border-b border-border">
          <button
            onClick={() => setViewMode('bySubcontractor')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'bySubcontractor'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            By Subcontractor
          </button>
          <button
            onClick={() => setViewMode('byDocumentType')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'byDocumentType'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" />
            By Document Type
          </button>
        </div>

        {viewMode === 'bySubcontractor' ? (
          /* By Subcontractor View */
          <div className="space-y-4">
            {console.log("[v0] Subcontractors:", subcontractors)}
            {subcontractors.map((sub) => {
              console.log("[v0] Sub:", sub.vendor_name, "document_types:", sub.document_types)
              const subDocs = documents.filter((d) => d.subcontractor_id === sub.id)
              const subDocTypes = sub.document_types || []
              const approvedCount = subDocs.filter((d) => d.status === 'approved').length
              const progress = subDocTypes.length > 0 ? Math.round((approvedCount / subDocTypes.length) * 100) : 0
              const isExpanded = !collapsedSubs.has(sub.id)

              return (
                <div key={sub.id} className="border border-border rounded-xl overflow-hidden bg-card">
                  {/* Subcontractor Header */}
                  <button
                    onClick={() => toggleSub(sub.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <HardHat className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{sub.vendor_name || sub.csi_division}</div>
                        <div className="text-sm text-muted-foreground">
                          {sub.csi_division} (CSI: {sub.csi_code?.padStart(6, '0') || '000000'})
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm">
                        <Check className="w-3 h-3 text-green-600" />
                        {progress}% Complete
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Documents */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {subDocTypes.map((docType) => {
                        const existingDoc = subDocs.find((d) => d.document_type === docType)
                        const isUploading = uploading === `${sub.id}-${docType}`

                        return (
                          <div
                            key={docType}
                            className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{docType}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {existingDoc ? (
                                <>
                                  {existingDoc.status === 'approved' ? (
                                    <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                                      <Check className="w-3 h-3" />
                                      Approved
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                                      <Clock className="w-3 h-3" />
                                      Pending
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                    <Clock className="w-3 h-3" />
                                    Not Submitted
                                  </span>
                                  <span className="text-sm text-muted-foreground">Pending</span>
                                </>
                              )}
                              {!existingDoc && (
                                <label className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors">
                                  <Upload className="w-4 h-4" />
                                  {isUploading ? 'Uploading...' : 'Upload File'}
                                  <input
                                    type="file"
                                    className="hidden"
                                    disabled={isUploading}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) handleUpload(sub.id, docType, file)
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* By Document Type View */
          <div className="space-y-4">
            {allDocumentTypes.map((docType) => {
              const docsOfType = documents.filter((d) => d.document_type === docType)
              const subsWithDocType = subcontractors.filter((s) => s.document_types?.includes(docType))
              const approvedCount = docsOfType.filter((d) => d.status === 'approved').length
              const progress = subsWithDocType.length > 0 ? Math.round((approvedCount / subsWithDocType.length) * 100) : 0
              const isExpanded = !collapsedDocTypes.has(docType)

              return (
                <div key={docType} className="border border-border rounded-xl overflow-hidden bg-card">
                  {/* Document Type Header */}
                  <button
                    onClick={() => toggleDocType(docType)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">{docType}</div>
                        <div className="text-sm text-muted-foreground">
                          {docsOfType.length} / {subsWithDocType.length} submitted
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm">
                        <Check className="w-3 h-3 text-green-600" />
                        {progress}% Complete
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded: Subcontractors for this doc type */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {subsWithDocType.map((sub) => {
                        const existingDoc = documents.find(
                          (d) => d.subcontractor_id === sub.id && d.document_type === docType
                        )
                        const isUploading = uploading === `${sub.id}-${docType}`

                        return (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-3">
                              <HardHat className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <span className="font-medium">{sub.vendor_name || sub.csi_division}</span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  ({sub.csi_code?.padStart(6, '0') || '000000'})
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {existingDoc ? (
                                <>
                                  {existingDoc.status === 'approved' ? (
                                    <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                                      <Check className="w-3 h-3" />
                                      Approved
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                                      <Clock className="w-3 h-3" />
                                      Pending
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                                    <Clock className="w-3 h-3" />
                                    Not Submitted
                                  </span>
                                  <span className="text-sm text-muted-foreground">Pending</span>
                                </>
                              )}
                              {!existingDoc && (
                                <label className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors">
                                  <Upload className="w-4 h-4" />
                                  {isUploading ? 'Uploading...' : 'Upload File'}
                                  <input
                                    type="file"
                                    className="hidden"
                                    disabled={isUploading}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) handleUpload(sub.id, docType, file)
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
