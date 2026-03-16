import { useGetProject, useListAllProjectDocuments, useApproveProject } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useParams } from "wouter";
import { Building2, CheckCircle, Clock, ExternalLink, FileText, FolderKanban, UploadCloud, Users, Filter, HardHat, ChevronRight } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SubcontractorList } from "@/components/SubcontractorList";
import { DocumentTrackingBoard } from "@/components/DocumentTrackingBoard";

export default function ProjectDetails() {
  const params = useParams();
  const projectId = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { data: allDocs, isLoading: docsLoading } = useListAllProjectDocuments(projectId);
  const approveMutation = useApproveProject();

  const handleApprove = () => {
    if (confirm("Are you sure you want to approve this closeout package? This will lock it and generate a client portal link.")) {
      approveMutation.mutate({ projectId }, {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
          toast({ title: "Project Approved!", description: "Client portal link generated.", variant: "default" });
        }
      });
    }
  };

  if (projectLoading) return <AppLayout><div className="animate-pulse h-96 bg-secondary/50 rounded-2xl"></div></AppLayout>;
  if (!project) return <AppLayout><div>Project not found</div></AppLayout>;

  return (
    <AppLayout>
      {/* Header Section */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={project.status} />
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-4 h-4" /> {project.clientName}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
                {project.name}
              </h1>
              {project.description && (
                <p className="mt-2 text-muted-foreground max-w-2xl">{project.description}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 bg-background p-4 rounded-xl border border-border/50">
              <div className="flex items-center gap-4 pr-4 border-r border-border">
                <div className="text-center">
                  <p className="text-2xl font-display font-bold text-foreground">{project.subcontractors.length}</p>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-display font-bold text-foreground">{project.approvedDocuments}</p>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Docs</p>
                </div>
              </div>
              
              <div className="text-center px-2">
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-secondary" />
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" 
                      strokeDasharray={2 * Math.PI * 28} 
                      strokeDashoffset={2 * Math.PI * 28 * (1 - project.progress / 100)}
                      className="text-primary transition-all duration-1000 ease-out" 
                    />
                  </svg>
                  <span className="absolute text-sm font-bold text-primary">{Math.round(project.progress)}%</span>
                </div>
              </div>

              {project.status === 'active' ? (
                <button 
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="w-full sm:w-auto ml-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                  Approve Package
                </button>
              ) : project.clientPortalToken && (
                <a 
                  href={`/client-portal/${project.clientPortalToken}`}
                  target="_blank"
                  className="w-full sm:w-auto ml-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  Client Portal
                  <ExternalLink className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs.Root defaultValue="tracking" className="flex flex-col w-full">
        <Tabs.List className="flex shrink-0 border-b border-border mb-6 overflow-x-auto hide-scrollbar">
          <Tabs.Trigger 
            value="tracking" 
            className="px-6 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <FolderKanban className="w-4 h-4" />
            Document Tracking
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="subcontractors" 
            className="px-6 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <HardHat className="w-4 h-4" />
            Subcontractors Directory
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="tracking" className="focus:outline-none">
          <DocumentTrackingBoard project={project} documents={allDocs || []} isLoading={docsLoading} />
        </Tabs.Content>

        <Tabs.Content value="subcontractors" className="focus:outline-none">
          <SubcontractorList project={project} />
        </Tabs.Content>
      </Tabs.Root>
    </AppLayout>
  );
}
