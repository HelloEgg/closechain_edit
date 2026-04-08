'use client';

import { Building2, Plus, ArrowRight, FolderKanban, HardHat, Search, LogOut } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// Mock data
const mockProjects = [
  {
    id: 1,
    name: "Downtown Office Complex",
    jobNumber: "JOB-2024-001",
    endDate: "2024-12-31",
    clientName: "Metro Development Corp",
    status: "in_progress" as const,
    uploadedDocuments: 45,
    totalDocuments: 120,
    progress: 37.5,
  },
  {
    id: 2,
    name: "Riverside Apartment Building",
    jobNumber: "JOB-2024-002",
    endDate: "2025-03-15",
    clientName: "Riverside Properties LLC",
    status: "in_progress" as const,
    uploadedDocuments: 89,
    totalDocuments: 150,
    progress: 59.3,
  },
  {
    id: 3,
    name: "Tech Campus Phase 2",
    jobNumber: "JOB-2024-003",
    endDate: "2024-11-30",
    clientName: "Innovation Tech Solutions",
    status: "approved" as const,
    uploadedDocuments: 200,
    totalDocuments: 200,
    progress: 100,
  },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'projects' | 'subcontractors'>('projects');
  const router = useRouter();

  const totalProjects = mockProjects.length;
  const publishedProjects = mockProjects.filter(p => p.status === "approved").length;
  const notPublishedProjects = totalProjects - publishedProjects;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Image src="/logo.svg" alt="Closechain AI" width={200} height={50} className="h-10 w-auto" />
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Projects Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of all your construction closeout packages.</p>
          </div>
          
          <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all hover:-translate-y-0.5">
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {[
            { label: "Total Projects", value: totalProjects, color: "bg-blue-50 text-blue-700", icon: FolderKanban },
            { label: "Not Published", value: notPublishedProjects, color: "bg-amber-50 text-amber-700", icon: FolderKanban },
            { label: "Published", value: publishedProjects, color: "bg-emerald-50 text-emerald-700", icon: FolderKanban },
          ].map((metric, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 border border-border shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-4xl font-display font-bold text-foreground">{metric.value}</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockProjects.map((project) => (
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
                  <p className="text-xs text-muted-foreground">Job Number: {project.jobNumber}</p>
                  <p className="text-xs text-muted-foreground">End Date: {project.endDate}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-6 line-clamp-1">{project.clientName}</p>
                
                <div className="mt-auto pt-6 border-t border-border/50">
                  <div className="flex justify-between items-end mb-2">
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">{project.uploadedDocuments}</span>
                      <span className="text-muted-foreground"> received</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="font-semibold text-foreground">{project.totalDocuments - project.uploadedDocuments}</span>
                      <span className="text-muted-foreground"> open</span>
                    </div>
                    <span className="text-xs font-bold text-primary">{Math.round(project.progress)}%</span>
                  </div>
                  
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-out"
                      style={{ width: `${Math.max(0, Math.min(100, project.progress))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subcontractor View */}
        {activeTab === 'subcontractors' && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
            <HardHat className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No subcontractors yet</h3>
            <p className="text-muted-foreground">Create a project and add subcontractors to see them here.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: "in_progress" | "approved" | "draft" }) {
  const variants = {
    in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
    approved: { label: "Published", className: "bg-green-100 text-green-700" },
    draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  };

  const variant = variants[status];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${variant.className}`}>
      {variant.label}
    </span>
  );
}
