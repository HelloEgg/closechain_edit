import { useListProjects, useListAllSubcontractors, useDeleteProject, type Project } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Building2, Plus, ArrowRight, FolderKanban, HardHat, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import * as Tabs from "@radix-ui/react-tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: projects, isLoading } = useListProjects();
  const [, navigate] = useLocation();

  const totalProjects = projects?.length || 0;
  const notPublished = projects?.filter(p => p.status === 'active').length || 0;
  const published = projects?.filter(p => p.status === 'approved').length || 0;

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Projects Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of all your construction closeout packages.</p>
        </div>
        
        <button
          onClick={() => navigate("/projects/new")}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        {[
          { label: "Total Projects", value: totalProjects, color: "bg-blue-50 text-blue-700", icon: FolderKanban },
          { label: "Not Published", value: notPublished, color: "bg-amber-50 text-amber-700", icon: FolderKanban },
          { label: "Published", value: published, color: "bg-emerald-50 text-emerald-700", icon: FolderKanban },
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

      <Tabs.Root defaultValue="projects" className="flex flex-col w-full">
        <Tabs.List className="flex shrink-0 border-b border-border mb-6">
          <Tabs.Trigger value="projects" className="px-6 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors flex items-center gap-2">
            <FolderKanban className="w-4 h-4" /> Project View
          </Tabs.Trigger>
          <Tabs.Trigger value="subcontractors" className="px-6 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors flex items-center gap-2">
            <HardHat className="w-4 h-4" /> Subcontractor View
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="projects" className="focus:outline-none">
          <ProjectsGridView projects={projects || []} isLoading={isLoading} onCreateClick={() => navigate("/projects/new")} />
        </Tabs.Content>

        <Tabs.Content value="subcontractors" className="focus:outline-none">
          <SubcontractorAggregateView />
        </Tabs.Content>
      </Tabs.Root>
    </AppLayout>
  );
}

function ProjectsGridView({ projects, isLoading, onCreateClick }: { projects: Project[], isLoading: boolean, onCreateClick: () => void }) {
  const deleteMutation = useDeleteProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (e: React.MouseEvent, projectId: number, projectName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${projectName}"? This will permanently remove the project, all subcontractors, and all documents. This cannot be undone.`)) return;
    deleteMutation.mutate({ projectId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        toast({ title: "Project deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete project", variant: "destructive" });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-64 bg-secondary/50 animate-pulse rounded-2xl border border-border"></div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
        <div className="mx-auto w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No projects yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">Get started by creating your first construction project to manage its closeout package.</p>
        <button onClick={onCreateClick} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> Create Project
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <Link key={project.id} href={`/projects/${project.id}`}>
          <div className="group bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col h-full cursor-pointer">
            <div className="flex justify-between items-start mb-4">
              <StatusBadge status={project.status} />
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleDelete(e, project.id, project.name)}
                  disabled={deleteMutation.isPending}
                  title="Delete project"
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ArrowRight className="text-primary w-5 h-5" />
              </div>
            </div>
            
            {project.endDate && (
              <span className="text-xs text-muted-foreground font-medium bg-secondary px-2 py-1 rounded-md inline-block mb-4">
                {project.endDate}
              </span>
            )}
            
            <h3 className="text-xl font-display font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.jobNumber && (
              <p className="text-xs text-muted-foreground mb-1">Job: {project.jobNumber}</p>
            )}
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
        </Link>
      ))}
    </div>
  );
}

function SubcontractorAggregateView() {
  const { data: allSubs, isLoading } = useListAllSubcontractors();
  const [search, setSearch] = useState("");

  const aggregated = useMemo(() => {
    if (!allSubs) return [];
    const map: Record<string, { vendorName: string; csiCode: string; csiDivision: string; totalDocuments: number; uploadedDocuments: number; approvedDocuments: number; projects: { projectId: number; projectName: string; progress: number }[] }> = {};
    for (const sub of allSubs) {
      const key = sub.vendorName.toLowerCase();
      if (!map[key]) {
        map[key] = { vendorName: sub.vendorName, csiCode: sub.csiCode, csiDivision: sub.csiDivision, totalDocuments: 0, uploadedDocuments: 0, approvedDocuments: 0, projects: [] };
      }
      map[key].totalDocuments += sub.totalDocuments;
      map[key].uploadedDocuments += sub.uploadedDocuments;
      map[key].approvedDocuments += sub.approvedDocuments;
      map[key].projects.push({
        projectId: sub.projectId,
        projectName: sub.projectName,
        progress: sub.progress,
      });
    }
    return Object.values(map);
  }, [allSubs]);

  const filtered = aggregated.filter(s =>
    s.vendorName.toLowerCase().includes(search.toLowerCase()) ||
    s.csiCode.includes(search)
  );

  if (isLoading) return <div className="h-64 bg-secondary/50 animate-pulse rounded-2xl"></div>;

  if (aggregated.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
        <HardHat className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">No subcontractors yet</h3>
        <p className="text-muted-foreground">Create a project and add subcontractors to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search subcontractors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendor</th>
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">CSI Code</th>
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projects</th>
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Docs</th>
              <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((sub, idx) => {
              const openDocs = sub.totalDocuments - sub.uploadedDocuments;
              const progress = sub.totalDocuments > 0
                ? Math.round((sub.uploadedDocuments / sub.totalDocuments) * 100)
                : 0;
              return (
                <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <HardHat className="w-5 h-5" />
                      </div>
                      <span className="font-semibold text-foreground">{sub.vendorName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground">
                      CSI {sub.csiCode}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs font-semibold text-foreground mr-1">{sub.projects.length}</span>
                      {sub.projects.map((p, pi) => (
                        <Link key={pi} href={`/projects/${p.projectId}`}>
                          <span className="text-xs text-primary hover:underline cursor-pointer bg-primary/5 px-2 py-1 rounded">{p.projectName}</span>
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">{sub.uploadedDocuments}</span>
                      <span className="text-muted-foreground"> received</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="font-semibold text-foreground">{openDocs}</span>
                      <span className="text-muted-foreground"> open</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden max-w-[100px]">
                        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs font-bold">{progress}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
