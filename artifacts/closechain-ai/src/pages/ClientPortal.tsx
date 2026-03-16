import { useGetClientPortal } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Building2, CheckCircle2, Download, FileText, HardHat } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const { data: portalData, isLoading, error } = useGetClientPortal(token);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium">Loading closeout package...</p>
      </div>
    );
  }

  if (error || !portalData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-card p-8 rounded-2xl shadow-lg border border-border max-w-md text-center">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Package Not Found</h2>
          <p className="text-muted-foreground">This link is invalid or the closeout package has not been approved yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-6 opacity-80">
            <Building2 className="w-5 h-5" />
            <span className="font-semibold tracking-wide uppercase text-sm">Closeout Package</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-extrabold tracking-tight mb-4">
            {portalData.projectName}
          </h1>
          <p className="text-xl opacity-90 max-w-2xl">{portalData.clientName}</p>
          
          <div className="mt-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 w-full">
              <div className="flex justify-between items-end mb-2">
                <span className="font-semibold">Overall Completion</span>
                <span className="font-bold text-xl">{Math.round(portalData.progress)}%</span>
              </div>
              <div className="h-3 w-full bg-black/20 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${portalData.progress}%` }} />
              </div>
            </div>
            <div className="shrink-0 text-center px-4 md:border-l border-white/20">
              <p className="text-3xl font-bold">{portalData.approvedDocuments}</p>
              <p className="text-xs uppercase tracking-wider opacity-80 font-medium">Docs Approved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-display font-bold text-foreground mb-6">Subcontractor Documents</h2>
        
        <div className="space-y-6">
          {portalData.subcontractors.map((sub, idx) => (
            <div key={idx} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="bg-secondary/50 px-6 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-primary">
                    <HardHat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{sub.vendorName}</h3>
                    <p className="text-sm text-muted-foreground">{sub.csiDivision} (CSI: {sub.csiCode})</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border border-border text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {Math.round(sub.progress)}% Complete
                </div>
              </div>
              
              <div className="p-0">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-border">
                    {sub.documents.map((doc, dIdx) => (
                      <tr key={dIdx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                            <div>
                              <p className="font-semibold text-foreground text-sm">{doc.documentType}</p>
                              {doc.fileName && <p className="text-xs text-muted-foreground mt-0.5">{doc.fileName}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 w-32">
                          <StatusBadge status={doc.status} />
                        </td>
                        <td className="px-6 py-4 w-32 text-right">
                          {doc.filePath ? (
                            <a 
                              href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/client-portal/${token}/download${doc.filePath.replace(/^\/objects/, "")}`} 
                              target="_blank"
                              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {sub.documents.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground text-sm">
                          No documents required for this trade.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
