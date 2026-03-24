import { useGetClientPortal, type ClientPortalData, type ClientPortalSubcontractor, type ClientPortalDocument } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Building2, CheckCircle2, Download, FileText, HardHat, FolderArchive } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useState, useMemo, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";

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
          <p className="text-muted-foreground">This link is invalid or the client portal has not been created yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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

          <DownloadAllButton token={token} hasDocuments={portalData.uploadedDocuments > 0} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs.Root defaultValue="subcontractor" className="flex flex-col w-full">
          <Tabs.List className="flex shrink-0 border-b border-border mb-6">
            <Tabs.Trigger value="subcontractor" className="px-6 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors flex items-center gap-2">
              <HardHat className="w-4 h-4" /> By Subcontractor
            </Tabs.Trigger>
            <Tabs.Trigger value="doctype" className="px-6 py-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary transition-colors flex items-center gap-2">
              <FileText className="w-4 h-4" /> By Document Type
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="subcontractor" className="focus:outline-none">
            <SubcontractorPortalView portalData={portalData} token={token} />
          </Tabs.Content>

          <Tabs.Content value="doctype" className="focus:outline-none">
            <DocTypePortalView portalData={portalData} token={token} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

function DownloadAllButton({ token, hasDocuments }: { token: string; hasDocuments: boolean }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadAll = useCallback(async () => {
    if (downloading || !hasDocuments) return;
    setDownloading(true);
    try {
      const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/client-portal/${token}/download-all`;
      const response = await fetch(url);
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Download failed" }));
        alert(err.error || "Failed to download documents");
        return;
      }
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || "Closeout Package.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      alert("Failed to download documents. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [token, downloading, hasDocuments]);

  if (!hasDocuments) return null;

  return (
    <div className="mt-6">
      <button
        onClick={handleDownloadAll}
        disabled={downloading}
        className="inline-flex items-center gap-2.5 px-6 py-3 bg-white text-primary font-semibold rounded-xl hover:bg-white/90 transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {downloading ? (
          <>
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Preparing Download...
          </>
        ) : (
          <>
            <FolderArchive className="w-5 h-5" />
            Download All Documents
          </>
        )}
      </button>
    </div>
  );
}

function SubcontractorPortalView({ portalData, token }: { portalData: ClientPortalData, token: string }) {
  return (
    <div className="space-y-6">
      {portalData.subcontractors.map((sub: ClientPortalSubcontractor, idx: number) => (
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
                {sub.documents.map((doc: ClientPortalDocument, dIdx: number) => (
                  <PortalDocRow key={dIdx} doc={doc} token={token} />
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
  );
}

function DocTypePortalView({ portalData, token }: { portalData: ClientPortalData, token: string }) {
  const groupedByType = useMemo(() => {
    const map: Record<string, { docs: { doc: ClientPortalDocument; sub: ClientPortalSubcontractor }[]; approved: number; total: number; subTypes?: Record<string, { docs: { doc: ClientPortalDocument; sub: ClientPortalSubcontractor }[]; approved: number; total: number }> }> = {};
    for (const sub of portalData.subcontractors) {
      for (const doc of sub.documents) {
        const isSub = !!doc.parentDocumentType;
        const groupKey = isSub ? doc.parentDocumentType! : doc.documentType;

        if (!map[groupKey]) {
          map[groupKey] = { docs: [], approved: 0, total: 0 };
        }
        map[groupKey].docs.push({ doc, sub });
        map[groupKey].total++;
        if (doc.status === "approved") map[groupKey].approved++;

        if (isSub) {
          if (!map[groupKey].subTypes) map[groupKey].subTypes = {};
          if (!map[groupKey].subTypes![doc.documentType]) {
            map[groupKey].subTypes![doc.documentType] = { docs: [], approved: 0, total: 0 };
          }
          map[groupKey].subTypes![doc.documentType].docs.push({ doc, sub });
          map[groupKey].subTypes![doc.documentType].total++;
          if (doc.status === "approved") map[groupKey].subTypes![doc.documentType].approved++;
        }
      }
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [portalData]);

  return (
    <div className="space-y-6">
      {groupedByType.map(([docType, data]) => {
        const progress = data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0;
        return (
          <div key={docType} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="bg-secondary/50 px-6 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{docType}</h3>
                  <p className="text-sm text-muted-foreground">{data.total} subcontractor{data.total !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border border-border text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {progress}% Complete
              </div>
            </div>
            
            <div className="p-0">
              <table className="w-full text-left">
                <tbody className="divide-y divide-border">
                  {data.subTypes && Object.keys(data.subTypes).length > 0 ? (
                    <>
                      {data.docs.filter(({ doc: d }) => d.documentType === docType).map(({ doc, sub }, dIdx) => (
                        <PortalDocTypeRow key={`direct-${dIdx}`} doc={doc} sub={sub} token={token} />
                      ))}
                      {Object.entries(data.subTypes).sort((a, b) => a[0].localeCompare(b[0])).map(([subTypeName, subTypeData]) => (
                        <>
                          <tr key={`header-${subTypeName}`} className="bg-secondary/30">
                            <td colSpan={3} className="px-6 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-1 h-4 bg-primary/40 rounded-full" />
                                <span className="text-sm font-semibold text-foreground">{subTypeName}</span>
                                <span className="text-xs text-muted-foreground">({subTypeData.approved}/{subTypeData.total} approved)</span>
                              </div>
                            </td>
                          </tr>
                          {subTypeData.docs.map(({ doc, sub }, dIdx) => (
                            <PortalDocTypeRow key={`${subTypeName}-${dIdx}`} doc={doc} sub={sub} token={token} />
                          ))}
                        </>
                      ))}
                    </>
                  ) : (
                    data.docs.map(({ doc, sub }, dIdx) => (
                      <PortalDocTypeRow key={dIdx} doc={doc} sub={sub} token={token} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PortalDocTypeRow({ doc, sub, token }: { doc: ClientPortalDocument, sub: ClientPortalSubcontractor, token: string }) {
  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <HardHat className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="font-semibold text-foreground text-sm">{sub.vendorName}</p>
            <p className="text-xs text-muted-foreground">{sub.csiDivision}</p>
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
  );
}

function PortalDocRow({ doc, token }: { doc: ClientPortalDocument, token: string }) {
  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
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
  );
}
