'use client'

import {
  ArrowLeft,
  Building2,
  Calendar,
  Hash,
  FileText,
  HardHat,
  Trash2,
  CheckCircle2,
  Download,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface Project {
  id: string
  name: string
  job_number: string
  end_date: string
  client_name: string
  status: 'draft' | 'in_progress' | 'approved'
  uploaded_documents: number
  total_documents: number
  approved_documents: number
  user_id: string
  created_at: string
}

interface Subcontractor {
  id: string
  name: string
  vendor_name: string
  vendor_code: string
  csi_code: string
  csi_division: string
  total_docs: number
  received_docs: number
  progress: number
  project_id: string
  user_id: string
  created_at: string
}

interface Profile {
  id: string
  full_name: string | null
  company_name: string | null
}

interface ProjectDetailsClientProps {
  project: Project
  subcontractors: Subcontractor[]
  user: User
  profile: Profile | null
}

export default function ProjectDetailsClient({
  project,
  subcontractors,
  user,
  profile,
}: ProjectDetailsClientProps) {
  const [activeTab, setActiveTab] = useState<'documents' | 'subcontractors'>('documents')
  const router = useRouter()

  const totalDocs = project.total_documents || 0
  const uploadedDocs = project.uploaded_documents || 0
  const approvedDocs = project.approved_documents || 0
  const progress = totalDocs > 0 ? Math.round((approvedDocs / totalDocs) * 100) : 0

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${project.name}"? This will permanently remove the project and all subcontractors. This cannot be undone.`)) {
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from('projects').delete().eq('id', project.id)

    if (error) {
      alert('Failed to delete project')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Image src="/logo.svg" alt="Closechain AI" width={200} height={50} className="h-10 w-auto" />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {profile?.full_name || user.email}
              </p>
              {profile?.company_name && (
                <p className="text-xs text-muted-foreground">{profile.company_name}</p>
              )}
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Project Header Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-8">
          <div className="p-6 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <StatusBadge status={project.status} />
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-4 h-4" /> {project.client_name}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" /> {project.job_number}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {new Date(project.end_date).toLocaleDateString()}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
                  {project.name}
                </h1>
              </div>

              <div className="flex items-center gap-4 shrink-0 bg-background p-4 rounded-xl border border-border/50">
                <div className="flex items-center gap-4 pr-4 border-r border-border">
                  <div className="text-center">
                    <p className="text-2xl font-display font-bold text-foreground">{subcontractors.length}</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-display font-bold text-foreground">{approvedDocs}</p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Docs</p>
                  </div>
                </div>

                <div className="text-center px-2">
                  <div className="relative inline-flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        className="text-secondary"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={2 * Math.PI * 28 * (1 - progress / 100)}
                        className="text-primary transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <span className="absolute text-sm font-bold text-primary">{Math.round(progress)}%</span>
                  </div>
                </div>

                <button
                  onClick={handleDelete}
                  title="Delete project"
                  className="ml-2 p-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-border"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-6 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'documents'
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <FileText className="w-4 h-4" /> Document View
            </button>
            <button
              onClick={() => setActiveTab('subcontractors')}
              className={`px-6 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'subcontractors'
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <HardHat className="w-4 h-4" /> Subcontractor View
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'documents' && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No documents yet</h3>
            <p className="text-muted-foreground">
              Document management will be available in a future update.
            </p>
          </div>
        )}

        {activeTab === 'subcontractors' && (
          <>
            {subcontractors.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
                <HardHat className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No subcontractors yet</h3>
                <p className="text-muted-foreground">Subcontractors will appear here once added to the project.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {subcontractors.map((sub) => {
                  const subProgress =
                    sub.total_docs > 0 ? Math.round((sub.received_docs / sub.total_docs) * 100) : 0

                  return (
                    <div
                      key={sub.id}
                      className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <HardHat className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-foreground">{sub.csi_division}</h3>
                            {sub.vendor_name && (
                              <p className="text-sm text-muted-foreground mt-0.5">{sub.vendor_name}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-medium text-muted-foreground">
                                Code: {sub.csi_code}
                              </span>
                              {sub.vendor_code && (
                                <span className="text-xs font-medium text-muted-foreground">
                                  • Vendor: {sub.vendor_code}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 md:w-1/3">
                          <div className="text-right flex-1">
                            <p className="text-sm font-bold text-foreground">
                              {sub.received_docs} / {sub.total_docs}
                            </p>
                            <p className="text-xs text-muted-foreground">Documents Received</p>
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-end mb-1">
                              <span className="text-xs font-bold text-primary">{subProgress}%</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${Math.max(0, Math.min(100, subProgress))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function StatusBadge({ status }: { status: 'in_progress' | 'approved' | 'draft' }) {
  const variants = {
    in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
    approved: { label: 'Published', className: 'bg-green-100 text-green-700' },
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  }

  const variant = variants[status]

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${variant.className}`}
    >
      {variant.label}
    </span>
  )
}
