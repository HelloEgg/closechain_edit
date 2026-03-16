import { useState } from "react";
import { type ProjectDetail, type DocumentSlotWithSubcontractor, useUpdateDocumentSlot, useAddDocumentSlot, useDeleteDocumentSlot } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FileText, UploadCloud, CheckCircle, Clock, Plus, Download, HardHat, Trash2 } from "lucide-react";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as Dialog from "@radix-ui/react-dialog";

export function DocumentTrackingBoard({ 
  project, 
  documents, 
  isLoading 
}: { 
  project: ProjectDetail, 
  documents: DocumentSlotWithSubcontractor[], 
  isLoading: boolean 
}) {
  const [expandedSub, setExpandedSub] = useState<number | null>(null);

  if (isLoading) return <div className="h-64 animate-pulse bg-secondary/50 rounded-2xl"></div>;

  // Group documents by subcontractor
  const groupedDocs = documents.reduce((acc, doc) => {
    if (!acc[doc.subcontractorId]) acc[doc.subcontractorId] = [];
    acc[doc.subcontractorId].push(doc);
    return acc;
  }, {} as Record<number, DocumentSlotWithSubcontractor[]>);

  return (
    <div className="space-y-4">
      {project.subcontractors.map((sub) => {
        const subsDocs = groupedDocs[sub.id] || [];
        const isExpanded = expandedSub === sub.id;
        
        return (
          <div key={sub.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
            {/* Header / Accordion Trigger */}
            <div 
              onClick={() => setExpandedSub(isExpanded ? null : sub.id)}
              className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary shrink-0">
                  <HardHat className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{sub.vendorName}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="font-medium bg-secondary px-2 py-0.5 rounded-md">{sub.csiDivision}</span>
                    <span>CSI: {sub.csiCode}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 md:w-1/3 justify-end">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-foreground">{sub.approvedDocuments} / {sub.totalDocuments}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div className="flex-1 max-w-[150px]">
                  <div className="flex justify-end mb-1">
                    <span className="text-xs font-bold text-primary">{Math.round(sub.progress)}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${sub.progress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-border bg-background p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" /> Required Documents
                  </h4>
                  <AddDocDialog projectId={project.id} subcontractorId={sub.id} />
                </div>

                <div className="grid gap-3">
                  {subsDocs.map(doc => (
                    <DocumentRow key={doc.id} doc={doc} projectId={project.id} isLocked={project.status === 'approved'} />
                  ))}
                  {subsDocs.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                      No documents required yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DocumentRow({ doc, projectId, isLocked }: { doc: DocumentSlotWithSubcontractor, projectId: number, isLocked: boolean }) {
  const { uploadFile, isUploading } = useFileUpload();
  const updateMutation = useUpdateDocumentSlot();
  const deleteMutation = useDeleteDocumentSlot();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { objectPath, fileName } = await uploadFile(file);
      
      updateMutation.mutate({
        documentSlotId: doc.id,
        data: {
          status: 'uploaded',
          filePath: objectPath,
          fileName: fileName
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
          toast({ title: "File uploaded successfully" });
        }
      });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const handleApprove = () => {
    updateMutation.mutate({
      documentSlotId: doc.id,
      data: { status: 'approved' }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
        toast({ title: "Document approved" });
      }
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors gap-4">
      <div className="flex items-center gap-4">
        <StatusBadge status={doc.status} />
        <div>
          <p className="font-semibold text-foreground">{doc.documentType}</p>
          {doc.fileName && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{doc.fileName}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {doc.status === 'not_submitted' && (
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors">
            <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading} />
            {isUploading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/> : <UploadCloud className="w-4 h-4" />}
            {isUploading ? "Uploading..." : "Upload File"}
          </label>
        )}

        {doc.status !== 'not_submitted' && doc.filePath && (
          <a 
            href={`/api${doc.filePath}`} 
            target="_blank"
            className="inline-flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> View
          </a>
        )}

        {doc.status === 'uploaded' && (
          <button 
            onClick={handleApprove}
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <CheckCircle className="w-4 h-4" /> Approve
          </button>
        )}

        {!isLocked && doc.status !== 'approved' && (
          <button
            onClick={() => {
              if (confirm(`Remove "${doc.documentType}" requirement?`)) {
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
            className="inline-flex items-center gap-1 px-2 py-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg text-sm transition-colors"
            title="Remove requirement"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function AddDocDialog({ projectId, subcontractorId }: { projectId: number, subcontractorId: number }) {
  const [open, setOpen] = useState(false);
  const mutation = useAddDocumentSlot();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const type = (new FormData(e.currentTarget)).get('documentType') as string;
    
    mutation.mutate({
      projectId,
      subcontractorId,
      data: { documentType: type }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
        setOpen(false);
        toast({ title: "Document slot added" });
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-2.5 py-1.5 rounded-md transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Requirement
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] bg-card p-6 rounded-2xl shadow-xl border border-border">
          <Dialog.Title className="text-lg font-display font-bold mb-4">Add Custom Requirement</Dialog.Title>
          <form onSubmit={handleSubmit}>
            <input 
              name="documentType" 
              required 
              placeholder="e.g., LEED Certification Form" 
              className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 outline-none mb-4" 
            />
            <div className="flex justify-end gap-2">
              <button type="submit" disabled={mutation.isPending} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
                Add Slot
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
