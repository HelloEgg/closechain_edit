'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trash2, Upload, Check, FileText, Building2, Calendar, LogOut, HardHat, Users, FolderOpen, ChevronDown, ChevronUp, Plus, Clock } from 'lucide-react'
import Image from 'next/image'
import ChatWidget from './chat-widget'

const DOCUMENT_TYPES = [
  'Submittal',
  'Shop Drawing',
  'Product Data',
  'Material Certificate',
  'Test Report',
  'Warranty',
  'O&M Manual',
  'As-Built Drawing',
  'Closeout Document',
]

interface Document {
  id: string
  document_type: string
  file_name: string
  file_url: string
  status: string
  uploaded_at: string
  approved_at: string | null
  subcontractor_id: string
}

interface Subcontractor {
  id: string
  name: string
  csi_division: string
  vendor_name: string
  vendor_code: string
  csi_code: string
  total_docs: number
  received_docs: number
  progress: number
}

interface Project {
  id: string
  name: string
  job_number: string
  client_name: string
  end_date: string
  status: string
  total_documents: number
  uploaded_documents: number
  approved_documents: number
}

interface Profile {
  full_name: string | null
  company_name: string | null
}

export default function ProjectDetailsClient({
  project: initialProject,
  subcontractors: initialSubcontractors,
  user,
  profile,
}: {
  project: Project
  subcontractors: Subcontractor[]
  user: any
  profile: Profile | null
}) {
  const router = useRouter()
  const [project, setProject] = useState<Project>(initialProject)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>(initialSubcontractors)
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeView, setActiveView] = useState<'documents' | 'subcontractors'>('documents')
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string | null>(
    initialSubcontractors[0]?.id || null
  )
  const [uploading, setUploading] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [subView, setSubView] = useState<'bySubcontractor' | 'bySection'>('bySubcontractor')
  const [expandedSub, setExpandedSub] = useState<string | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })

    if (data) {
      setDocuments(data)
    }
    setLoading(false)
  }

  const refreshData = async () => {
    const supabase = createClient()

    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project.id)
      .single()

    const { data: subsData } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('project_id', project.id)

    const { data: docsData } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })

    if (projectData) setProject(projectData)
    if (subsData) setSubcontractors(subsData)
    if (docsData) setDocuments(docsData)
  }

  const handleUpload = async (subcontractorId: string, documentType: string, file: File) => {
    setUploading(`${subcontractorId}-${documentType}`)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', project.id)
      formData.append('subcontractorId', subcontractorId)
      formData.append('documentType', documentType)

      const response = await fetch('/api/upload-document', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      await refreshData()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload document')
    } finally {
      setUploading(null)
    }
  }

  const handleApprove = async (documentId: string) => {
    try {
      const response = await fetch('/api/approve-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, projectId: project.id }),
      })

      if (!response.ok) {
        throw new Error('Approval failed')
      }

      await refreshData()
    } catch (error) {
      console.error('Approval error:', error)
      alert('Failed to approve document')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project?')) return

    const supabase = createClient()
    const { error } = await supabase.from('projects').delete().eq('id', project.id)

    if (error) {
      alert('Failed to delete project')
      return
    }

    router.push('/dashboard')
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700'
      case 'active':
      case 'in_progress':
        return 'bg-blue-100 text-blue-700'
      case 'completed':
      case 'approved':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const overallProgress =
    project.total_documents > 0
      ? Math.round(((project.uploaded_documents || 0) / project.total_documents) * 100)
      : 0

  const currentSubcontractor = subcontractors.find((s) => s.id === selectedSubcontractor)
  const subcontractorDocs = documents.filter((d) => d.subcontractor_id === selectedSubcontractor)

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Image src="/logo.svg" alt="Closechain AI" width={200} height={50} className="h-10 w-auto" />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{profile?.full_name || user.email}</p>
              {profile?.company_name && <p className="text-xs text-muted-foreground">{profile.company_name}</p>}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="bg-card rounded-2xl border border-border p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                    project.status || 'draft'
                  )}`}
                >
                  {(project.status || 'draft').charAt(0).toUpperCase() + (project.status || 'draft').slice(1)}
                </span>
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-4 h-4" /> {project.client_name}
                </span>
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> {project.job_number}
                </span>
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {new Date(project.end_date).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-4xl font-display font-bold text-foreground mb-4">{project.name}</h1>
            </div>
            <button
              onClick={handleDelete}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{subcontractors.length}</div>
              <div className="text-sm text-muted-foreground mt-1">SUBS</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{project.approved_documents || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">DOCS</div>
            </div>
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - overallProgress / 100)}`}
                    className="text-primary transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-foreground">{overallProgress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveView('documents')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeView === 'documents'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-4 h-4" />
              Document View
            </button>
            <button
              onClick={() => setActiveView('subcontractors')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeView === 'subcontractors'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <HardHat className="w-4 h-4" />
              Subcontractor View
            </button>
          </div>

          <div className="p-6">
            {activeView === 'documents' ? (
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-2">
                  {subcontractors.map((sub) => {
                    const subDocs = documents.filter((d) => d.subcontractor_id === sub.id)
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubcontractor(sub.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                          selectedSubcontractor === sub.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        <div className="font-medium text-sm">{sub.csi_division}</div>
                        <div className="text-xs opacity-80 mt-1">
                          {subDocs.length} / {DOCUMENT_TYPES.length} docs
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="col-span-3">
                  {currentSubcontractor ? (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">{currentSubcontractor.csi_division}</h3>
                      <div className="space-y-3">
                        {DOCUMENT_TYPES.map((docType) => {
                          const existingDoc = subcontractorDocs.find((d) => d.document_type === docType)
                          const isUploading = uploading === `${currentSubcontractor.id}-${docType}`

                          return (
                            <div key={docType} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                              <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">{docType}</div>
                                  {existingDoc && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {existingDoc.file_name} •{' '}
                                      {new Date(existingDoc.uploaded_at).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {existingDoc ? (
                                  <>
                                    <a
                                      href={`/api/file?pathname=${encodeURIComponent(existingDoc.file_url)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1 text-sm bg-background rounded hover:bg-background/80"
                                    >
                                      View
                                    </a>
                                    {existingDoc.status === 'uploaded' && (
                                      <button
                                        onClick={() => handleApprove(existingDoc.id)}
                                        className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                                      >
                                        <Check className="w-3 h-3" />
                                        Approve
                                      </button>
                                    )}
                                    {existingDoc.status === 'approved' && (
                                      <span className="flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-700 rounded">
                                        <Check className="w-3 h-3" />
                                        Approved
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <label className="flex items-center gap-1 px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 cursor-pointer">
                                    <Upload className="w-3 h-3" />
                                    {isUploading ? 'Uploading...' : 'Upload'}
                                    <input
                                      type="file"
                                      className="hidden"
                                      disabled={isUploading}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                          handleUpload(currentSubcontractor.id, docType, file)
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      Select a subcontractor to view documents
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Sub-tabs: By Subcontractor / By Section */}
                <div className="flex gap-2 mb-6">
                  <button
                    onClick={() => setSubView('bySubcontractor')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      subView === 'bySubcontractor'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    By Subcontractor
                  </button>
                  <button
                    onClick={() => setSubView('bySection')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      subView === 'bySection'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    By Section
                  </button>
                </div>

                {subView === 'bySubcontractor' ? (
                  <div className="space-y-3">
                    {subcontractors.map((sub) => {
                      const subDocs = documents.filter((d) => d.subcontractor_id === sub.id)
                      const approvedCount = subDocs.filter((d) => d.status === 'approved').length
                      const totalDocs = DOCUMENT_TYPES.length
                      const progress = totalDocs > 0 ? Math.round((approvedCount / totalDocs) * 100) : 0
                      const isExpanded = expandedSub === sub.id

                      return (
                        <div key={sub.id} className="border border-border rounded-xl overflow-hidden">
                          {/* Subcontractor Header */}
                          <button
                            onClick={() => setExpandedSub(isExpanded ? null : sub.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                                <HardHat className="w-6 h-6 text-muted-foreground" />
                              </div>
                              <div className="text-left">
                                <div className="font-semibold text-lg">{sub.vendor_name || sub.csi_division}</div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-medium">
                                    {sub.csi_division}
                                  </span>
                                  <span>CSI: {sub.csi_code?.padStart(6, '0') || '000000'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="font-semibold">
                                  {approvedCount} / {totalDocs}
                                </div>
                                <div className="text-xs text-muted-foreground">Approved</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">{progress}%</span>
                                <div className="w-20 bg-muted rounded-full h-1.5">
                                  <div
                                    className="bg-primary h-1.5 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                          </button>

                          {/* Expanded Documents */}
                          {isExpanded && (
                            <div className="border-t border-border bg-muted/30 p-4">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-medium flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Required Documents
                                </h4>
                                <button className="flex items-center gap-1 text-sm text-primary hover:underline">
                                  <Plus className="w-4 h-4" />
                                  Add Requirement
                                </button>
                              </div>
                              <div className="space-y-2">
                                {DOCUMENT_TYPES.map((docType) => {
                                  const existingDoc = subDocs.find((d) => d.document_type === docType)
                                  const isUploading = uploading === `${sub.id}-${docType}`
                                  
                                  return (
                                    <div
                                      key={docType}
                                      className="flex items-center justify-between p-3 bg-background rounded-lg border border-border"
                                    >
                                      <div className="flex items-center gap-3">
                                        {existingDoc ? (
                                          existingDoc.status === 'approved' ? (
                                            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                                              <Check className="w-3 h-3" />
                                              Approved
                                            </span>
                                          ) : (
                                            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                              <Clock className="w-3 h-3" />
                                              Uploaded
                                            </span>
                                          )
                                        ) : (
                                          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                            <Clock className="w-3 h-3" />
                                            Not Submitted
                                          </span>
                                        )}
                                        <span className="font-medium">{docType}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {existingDoc ? (
                                          <>
                                            <a
                                              href={`/api/file?pathname=${encodeURIComponent(existingDoc.file_url)}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                                            >
                                              View
                                            </a>
                                            {existingDoc.status === 'uploaded' && (
                                              <button
                                                onClick={() => handleApprove(existingDoc.id)}
                                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                                              >
                                                Approve
                                              </button>
                                            )}
                                          </>
                                        ) : (
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
                                        <button className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* By Section View */
                  <div className="space-y-3">
                    {DOCUMENT_TYPES.map((docType) => {
                      const docsOfType = documents.filter((d) => d.document_type === docType)
                      const approvedCount = docsOfType.filter((d) => d.status === 'approved').length
                      const totalForType = subcontractors.length
                      const progress = totalForType > 0 ? Math.round((approvedCount / totalForType) * 100) : 0

                      return (
                        <div
                          key={docType}
                          className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                              <FolderOpen className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-semibold text-lg">{docType}</div>
                              <div className="text-sm text-muted-foreground">
                                {docsOfType.length} document{docsOfType.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="font-semibold">
                                {approvedCount} / {totalForType}
                              </div>
                              <div className="text-xs text-muted-foreground">Approved</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium">{progress}%</span>
                              <div className="w-20 bg-muted rounded-full h-1.5">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* AI Chat Widget */}
      <ChatWidget projectId={project.id} />
    </div>
  )
}
