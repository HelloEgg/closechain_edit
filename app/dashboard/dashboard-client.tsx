'use client'

import { Building2, Plus, ArrowRight, FolderKanban, HardHat, LogOut } from 'lucide-react'
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
  user_id: string
  created_at: string
}

interface Profile {
  id: string
  full_name: string | null
  company_name: string | null
}

interface DashboardClientProps {
  projects: Project[]
  user: User
  profile: Profile | null
}

export default function DashboardClient({ projects, user, profile }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'projects' | 'subcontractors'>('projects')
  const router = useRouter()

  const totalProjects = projects?.length || 0
  const publishedProjects = projects?.filter((p) => p.status === 'approved').length || 0
  const notPublishedProjects = totalProjects - publishedProjects

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Projects Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of all your construction closeout packages.
            </p>
          </div>

          <button
            onClick={() => router.push('/dashboard/new')}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {[
            {
              label: 'Total Projects',
              value: totalProjects,
              color: 'bg-blue-50 text-blue-700',
              icon: FolderKanban,
            },
            {
              label: 'Not Published',
              value: notPublishedProjects,
              color: 'bg-amber-50 text-amber-700',
              icon: FolderKanban,
            },
            {
              label: 'Published',
              value: publishedProjects,
              color: 'bg-emerald-50 text-emerald-700',
              icon: FolderKanban,
            },
          ].map((metric, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-4xl font-display font-bold text-foreground">
                  {metric.value}
                </span>
                <div className={`p-1.5 rounded-md ${metric.color}`}>
                  <metric.icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-6 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'projects'
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <FolderKanban className="w-4 h-4" /> Project View
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

        {/* Projects Grid */}
        {activeTab === 'projects' && (
          <>
            {projects.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
                <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first project to get started with closeout management.
                </p>
                <button
                  onClick={() => router.push('/dashboard/new')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => {
                  const progress =
                    project.total_documents > 0
                      ? (project.uploaded_documents / project.total_documents) * 100
                      : 0

                  return (
                    <div
                      key={project.id}
                      className="group bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col h-full cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="text-primary w-5 h-5" />
                      </div>

                      <div className="flex justify-between items-start mb-4">
                        <StatusBadge status={project.status} />
                      </div>

                      <h3 className="text-xl font-display font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-1">
                        <p className="text-xs text-muted-foreground">
                          Job Number: {project.job_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          End Date: {new Date(project.end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground mb-6 line-clamp-1">
                        {project.client_name}
                      </p>

                      <div className="mt-auto pt-6 border-t border-border/50">
                        <div className="flex justify-between items-end mb-2">
                          <div className="text-sm">
                            <span className="font-semibold text-foreground">
                              {project.uploaded_documents}
                            </span>
                            <span className="text-muted-foreground"> received</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className="font-semibold text-foreground">
                              {project.total_documents - project.uploaded_documents}
                            </span>
                            <span className="text-muted-foreground"> open</span>
                          </div>
                          <span className="text-xs font-bold text-primary">
                            {Math.round(progress)}%
                          </span>
                        </div>

                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-out"
                            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Subcontractor View */}
        {activeTab === 'subcontractors' && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
            <HardHat className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No subcontractors yet</h3>
            <p className="text-muted-foreground">
              Create a project and add subcontractors to see them here.
            </p>
          </div>
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
