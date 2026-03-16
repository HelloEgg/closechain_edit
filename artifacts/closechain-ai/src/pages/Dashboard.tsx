import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Link } from "wouter";
import { useState } from "react";
import { Building2, Plus, ArrowRight, FolderKanban, MoreVertical, X } from "lucide-react";
import { format } from "date-fns";
import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: projects, isLoading } = useListProjects();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Stats calculation
  const totalProjects = projects?.length || 0;
  const activeProjects = projects?.filter(p => p.status === 'active').length || 0;
  const approvedProjects = projects?.filter(p => p.status === 'approved').length || 0;

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Projects Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of all your construction closeout packages.</p>
        </div>
        
        <CreateProjectDialog 
          open={isCreateOpen} 
          onOpenChange={setIsCreateOpen} 
          trigger={
            <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:shadow-md hover:bg-primary/90 transition-all hover:-translate-y-0.5">
              <Plus className="w-4 h-4" />
              New Project
            </button>
          }
        />
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        {[
          { label: "Total Projects", value: totalProjects, color: "bg-blue-50 text-blue-700" },
          { label: "Active Closeouts", value: activeProjects, color: "bg-amber-50 text-amber-700" },
          { label: "Approved Packages", value: approvedProjects, color: "bg-emerald-50 text-emerald-700" },
        ].map((metric, i) => (
          <div key={i} className="bg-card rounded-2xl p-6 border border-border shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-4xl font-display font-bold text-foreground">{metric.value}</span>
              <div className={`p-1.5 rounded-md ${metric.color}`}>
                <FolderKanban className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-secondary/50 animate-pulse rounded-2xl border border-border"></div>
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">Get started by creating your first construction project to manage its closeout package.</p>
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="group bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 flex flex-col h-full cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="text-primary w-5 h-5" />
                </div>
                
                <div className="flex justify-between items-start mb-4">
                  <StatusBadge status={project.status} />
                  <span className="text-xs text-muted-foreground font-medium bg-secondary px-2 py-1 rounded-md">
                    {format(new Date(project.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
                
                <h3 className="text-xl font-display font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-6 line-clamp-1">{project.clientName}</p>
                
                <div className="mt-auto pt-6 border-t border-border/50">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{project.approvedDocuments} <span className="text-muted-foreground font-normal">/ {project.totalDocuments} docs</span></p>
                    </div>
                    <span className="text-xs font-bold text-primary">{Math.round(project.progress)}%</span>
                  </div>
                  
                  {/* Progress bar */}
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
      )}
    </AppLayout>
  );
}

function CreateProjectDialog({ open, onOpenChange, trigger }: { open: boolean, onOpenChange: (v: boolean) => void, trigger: React.ReactNode }) {
  const createMutation = useCreateProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const clientName = formData.get('clientName') as string;
    const description = formData.get('description') as string;

    if (!name || !clientName) return;

    createMutation.mutate({
      data: { name, clientName, description }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        onOpenChange(false);
        toast({ title: "Project created successfully", variant: "default" });
      },
      onError: (err) => {
        toast({ title: "Failed to create project", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-card p-6 rounded-2xl shadow-2xl border border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex justify-between items-start mb-5">
            <Dialog.Title className="text-xl font-display font-bold">Create New Project</Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></Dialog.Close>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Project Name <span className="text-destructive">*</span></label>
              <input 
                name="name" 
                required 
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow" 
                placeholder="e.g., Downtown Office Reno"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Client Name <span className="text-destructive">*</span></label>
              <input 
                name="clientName" 
                required 
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow" 
                placeholder="e.g., Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Description (Optional)</label>
              <textarea 
                name="description" 
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow resize-none" 
                placeholder="Brief project details..."
              />
            </div>
            
            <div className="pt-4 flex justify-end gap-3">
              <Dialog.Close type="button" className="px-4 py-2 rounded-lg font-medium text-muted-foreground hover:bg-secondary transition-colors">
                Cancel
              </Dialog.Close>
              <button 
                type="submit" 
                disabled={createMutation.isPending}
                className="px-5 py-2 rounded-lg font-medium bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {createMutation.isPending ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
