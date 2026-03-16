import { useGetProject, useListAllProjectDocuments, useApproveProject, useDeleteProject, useDeleteDocumentSlot, type ProjectDetail, type DocumentSlotWithSubcontractor } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useParams, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Building2, CheckCircle, ExternalLink, FileText, FolderKanban, HardHat, Calendar, Hash, Trash2 } from "lucide-react";
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
  const [, navigate] = useLocation();

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { data: allDocs, isLoading: docsLoading } = useListAllProjectDocuments(projectId);
  const approveMutation = useApproveProject();
  const deleteMutation = useDeleteProject();

  const handleApprove = () => {
    if (confirm("Are you sure you want to approve this closeout package? This will lock it and generate a client portal link.")) {
      approveMutation.mutate({ projectId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
          toast({ title: "Project Approved!", description: "Client portal link generated.", variant: "default" });
        }
      });
    }
  };

  const handleDelete = () => {
    if (!project) return;
    if (!confirm(`Delete "${project.name}"? This will permanently remove the project, all subcontractors, and all documents. This cannot be undone.`)) return;
    deleteMutation.mutate({ projectId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        toast({ title: "Project deleted" });
        navigate("/dashboard");
      },
      onError: () => {
        toast({ title: "Failed to delete project", variant: "destructive" });
      },
    });
  };

  if (projectLoading) return <AppLayout><div className="animate-pulse h-96 bg-secondary/50 rounded-2xl"></div></AppLayout>;
  if (!project) return <AppLayout><div>Project not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={project.status} />
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-4 h-4" /> {project.clientName}
                </span>
                {project.jobNumber && (
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" /> {project.jobNumber}
                  </span>
                )}
                {project.endDate && (
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {project.endDate}
                  </span>
                )}
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

              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                title="Delete project"
                className="ml-2 p-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors border border-border"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Tabs.Root defaultValue="doctype" className="flex flex-col w-full">
        <Tabs.List className="flex shrink-0 border-b border-border mb-6 overflow-x-auto hide-scrollbar">
          <Tabs.Trigger value="doctype" className="px-6 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors flex items-center gap-2 whitespace-nowrap">
            <FileText className="w-4 h-4" />
            Document Type View
          </Tabs.Trigger>
          <Tabs.Trigger value="tracking" className="px-6 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors flex items-center gap-2 whitespace-nowrap">
            <FolderKanban className="w-4 h-4" />
            Subcontractor View
          </Tabs.Trigger>
          <Tabs.Trigger value="subcontractors" className="px-6 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors flex items-center gap-2 whitespace-nowrap">
            <HardHat className="w-4 h-4" />
            Subcontractors Directory
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="doctype" className="focus:outline-none">
          <DocumentTypeView project={project} documents={allDocs || []} isLoading={docsLoading} projectId={projectId} />
        </Tabs.Content>

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

function DocumentTypeView({ project, documents, isLoading, projectId }: { project: ProjectDetail, documents: DocumentSlotWithSubcontractor[], isLoading: boolean, projectId: number }) {
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const deleteMutation = useDeleteDocumentSlot();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isLocked = project.status === 'approved';

  const groupedByType = useMemo(() => {
    const map: Record<string, { docs: DocumentSlotWithSubcontractor[], approved: number, total: number }> = {};
    for (const doc of documents) {
      if (!map[doc.documentType]) {
        map[doc.documentType] = { docs: [], approved: 0, total: 0 };
      }
      map[doc.documentType].docs.push(doc);
      map[doc.documentType].total++;
      if (doc.status === 'approved') map[doc.documentType].approved++;
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [documents]);

  if (isLoading) return <div className="h-64 animate-pulse bg-secondary/50 rounded-2xl"></div>;

  if (groupedByType.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-12 text-center shadow-sm">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">No documents yet</h3>
        <p className="text-muted-foreground">Add subcontractors to auto-generate required document slots.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedByType.map(([docType, data]) => {
        const isExpanded = expandedType === docType;
        const progress = data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0;

        return (
          <div key={docType} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
            <div
              onClick={() => setExpandedType(isExpanded ? null : docType)}
              className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{docType}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{data.total} subcontractor{data.total !== 1 ? "s" : ""} require this</p>
                </div>
              </div>

              <div className="flex items-center gap-6 md:w-1/3 justify-end">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-foreground">{data.approved} / {data.total}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div className="flex-1 max-w-[150px]">
                  <div className="flex justify-end mb-1">
                    <span className="text-xs font-bold text-primary">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border bg-background p-6">
                <div className="grid gap-3">
                  {data.docs.map((doc: DocumentSlotWithSubcontractor) => (
                    <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors gap-3">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={doc.status} />
                        <div>
                          <p className="font-semibold text-foreground text-sm">{doc.vendorName || `Sub #${doc.subcontractorId}`}</p>
                          <p className="text-xs text-muted-foreground">CSI {doc.csiCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.fileName && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.fileName}</span>
                        )}
                        {!isLocked && doc.status !== 'approved' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remove "${doc.documentType}" requirement for ${doc.vendorName || 'this subcontractor'}?`)) {
                                deleteMutation.mutate({ documentSlotId: doc.id }, {
                                  onSuccess: () => {
                                    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
                                    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
                                    toast({ title: "Document requirement removed" });
                                  }
                                });
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg text-sm transition-colors"
                            title="Remove requirement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
