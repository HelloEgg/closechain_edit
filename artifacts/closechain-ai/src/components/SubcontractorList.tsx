import { useState, useMemo } from "react";
import {
  useCreateSubcontractor,
  useDeleteSubcontractor,
  useImportSubcontractors,
  useListCsiDivisions,
  type ProjectDetail,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as Dialog from "@radix-ui/react-dialog";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { FileUp, Plus, X, Search, HardHat, Trash2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { DocumentTypeCombobox } from "@/components/DocumentTypeCombobox";

export function SubcontractorList({ project }: { project: ProjectDetail }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deleteMutation = useDeleteSubcontractor();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isLocked = project.status === "approved";

  const filteredSubs = project.subcontractors.filter(
    (sub) =>
      sub.csiCode !== "000000" &&
      (sub.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      sub.csiDivision.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = (subId: number, vendorName: string) => {
    if (!confirm(`Remove "${vendorName}" from this project? All their document slots will also be deleted.`)) return;
    deleteMutation.mutate(
      { projectId: project.id, subcontractorId: subId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/documents`] });
          toast({ title: "Subcontractor removed" });
        },
        onError: () => {
          toast({ title: "Failed to remove subcontractor", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search subcontractors or trades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          {!isLocked && (
            <>
              <ImportDialog projectId={project.id} open={isImportOpen} onOpenChange={setIsImportOpen} />
              <AddSubDialog projectId={project.id} open={isAddOpen} onOpenChange={setIsAddOpen} />
            </>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-secondary/50 border-b border-border">
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trade / CSI</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</th>
                {!isLocked && (
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredSubs.map((sub) => (
                <tr key={sub.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <HardHat className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{sub.vendorName}</p>
                        <p className="text-xs text-muted-foreground">Code: {sub.vendorCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground">
                      {sub.csiDivision}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">CSI: {sub.csiCode}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{sub.approvedDocuments} / {sub.totalDocuments} Approved</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden max-w-[100px]">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${sub.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold">{Math.round(sub.progress)}%</span>
                    </div>
                  </td>
                  {!isLocked && (
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleDelete(sub.id, sub.vendorName)}
                        disabled={deleteMutation.isPending}
                        title="Remove subcontractor"
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredSubs.length === 0 && (
                <tr>
                  <td colSpan={isLocked ? 4 : 5} className="px-6 py-12 text-center text-muted-foreground">
                    No subcontractors found. Add one manually or import from CSV/Excel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AddSubDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mutation = useCreateSubcontractor();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: csiDivisions } = useListCsiDivisions();

  const [step, setStep] = useState<1 | 2>(1);
  const [vendorName, setVendorName] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [csiCode, setCsiCode] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  const allDocumentTypes = useMemo(() => {
    const set = new Set<string>();
    csiDivisions?.forEach((d) => {
      d.requiredDocuments.forEach((r) => set.add(r.documentType));
    });
    return Array.from(set).sort();
  }, [csiDivisions]);

  const selectedDivision = csiDivisions?.find((d) => d.code === csiCode);

  const resetForm = () => {
    setStep(1);
    setVendorName("");
    setVendorCode("");
    setCsiCode("");
    setSelectedDocs([]);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const goToStep2 = () => {
    if (!vendorName.trim() || !csiCode) return;
    const defaultDocs = selectedDivision?.requiredDocuments.map((r) => r.documentType) || [];
    setSelectedDocs([...defaultDocs]);
    setStep(2);
  };

  const toggleDoc = (doc: string) => {
    setSelectedDocs((prev) =>
      prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc]
    );
  };

  const addCustomDoc = (docType: string) => {
    const trimmed = docType.trim();
    if (!trimmed || selectedDocs.includes(trimmed)) return;
    setSelectedDocs((prev) => [...prev, trimmed]);
  };

  const handleSubmit = () => {
    if (!vendorName.trim() || !csiCode) return;
    mutation.mutate(
      {
        projectId,
        data: {
          vendorName: vendorName.trim(),
          vendorCode: vendorCode.trim() || vendorName.trim().slice(0, 6).toUpperCase(),
          csiCode,
          documentTypes: selectedDocs,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
          handleOpenChange(false);
          toast({ title: "Subcontractor added", description: `${selectedDocs.length} document slots created.` });
        },
        onError: (err: Error) => {
          toast({ title: "Failed to add subcontractor", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const knownDocTypes = new Set(selectedDivision?.requiredDocuments.map((r) => r.documentType) || []);
  const customOnlyDocs = selectedDocs.filter((d) => !knownDocTypes.has(d));

  const groupedRequiredDocs = useMemo(() => {
    if (!selectedDivision) return [];
    const parentMap: Record<string, string[]> = {};
    const standalone: string[] = [];
    for (const req of selectedDivision.requiredDocuments) {
      if (req.parentDocumentType) {
        if (!parentMap[req.parentDocumentType]) parentMap[req.parentDocumentType] = [];
        parentMap[req.parentDocumentType].push(req.documentType);
      } else {
        standalone.push(req.documentType);
      }
    }
    return { standalone, parentMap };
  }, [selectedDivision]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> Add Subcontractor
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
            <div>
              <Dialog.Title className="text-xl font-display font-bold">Add Subcontractor</Dialog.Title>
              <p className="text-xs text-muted-foreground mt-0.5">Step {step} of 2 — {step === 1 ? "Vendor Info" : "Select Documents"}</p>
            </div>
            <Dialog.Close className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {step === 1 && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Vendor Name <span className="text-destructive">*</span></label>
                <input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g., ABC Mechanical Inc."
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Vendor Code</label>
                <input
                  value={vendorCode}
                  onChange={(e) => setVendorCode(e.target.value)}
                  placeholder="e.g., ABC-MECH (optional)"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Trade / CSI Division <span className="text-destructive">*</span></label>
                <select
                  value={csiCode}
                  onChange={(e) => setCsiCode(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 outline-none"
                >
                  <option value="">Select a trade...</option>
                  {csiDivisions?.map((div) => (
                    <option key={div.code} value={div.code}>
                      {div.code} — {div.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedDivision && (
                <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
                  {selectedDivision.requiredDocuments.length} documents auto-assigned for this trade. You can customize them in the next step.
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Dialog.Close className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
                  Cancel
                </Dialog.Close>
                <button
                  onClick={goToStep2}
                  disabled={!vendorName.trim() || !csiCode}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-6 flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  {selectedDivision?.name} — Documents
                </p>
                <p className="text-xs text-muted-foreground">Check the documents required for {vendorName}. Uncheck any that don't apply.</p>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1 rounded-xl border border-border bg-background p-3">
                {groupedRequiredDocs && typeof groupedRequiredDocs === 'object' && !Array.isArray(groupedRequiredDocs) && (
                  <>
                    {(groupedRequiredDocs as { standalone: string[]; parentMap: Record<string, string[]> }).standalone.map((doc) => (
                      <label key={doc} className="flex items-center gap-3 py-1.5 px-1 cursor-pointer rounded-lg hover:bg-secondary/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedDocs.includes(doc)}
                          onChange={() => toggleDoc(doc)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-foreground flex-1">{doc}</span>
                      </label>
                    ))}
                    {Object.entries((groupedRequiredDocs as { standalone: string[]; parentMap: Record<string, string[]> }).parentMap).map(([parent, subDocs]) => (
                      <div key={parent} className="mt-1">
                        <div className="flex items-center gap-2 py-1 px-1">
                          <div className="w-1 h-4 bg-primary/30 rounded-full shrink-0" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{parent}</span>
                        </div>
                        {subDocs.map((doc) => (
                          <label key={doc} className="flex items-center gap-3 py-1.5 pl-5 pr-1 cursor-pointer rounded-lg hover:bg-secondary/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedDocs.includes(doc)}
                              onChange={() => toggleDoc(doc)}
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-foreground flex-1">{doc}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </>
                )}
                {customOnlyDocs.map((doc) => (
                  <label key={doc} className="flex items-center gap-3 py-1.5 px-1 cursor-pointer rounded-lg hover:bg-secondary/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedDocs.includes(doc)}
                      onChange={() => toggleDoc(doc)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-foreground flex-1">{doc}</span>
                    <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">custom</span>
                  </label>
                ))}
              </div>

              <DocumentTypeCombobox
                allDocumentTypes={allDocumentTypes}
                selectedDocumentTypes={selectedDocs}
                onAdd={addCustomDoc}
                placeholder="Add document type..."
              />

              <p className="text-xs text-muted-foreground">{selectedDocs.length} document{selectedDocs.length !== 1 ? "s" : ""} selected</p>

              <div className="flex justify-between gap-3 pt-1">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={mutation.isPending || selectedDocs.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  {mutation.isPending ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>
                  ) : (
                    <><Check className="w-4 h-4" /> Add Subcontractor</>
                  )}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ImportDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mutation = useImportSubcontractors();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const parseRows = (rows: Record<string, string>[]) => {
    const mapped = rows
      .map((row) => ({
        vendorName: row["Vendor Name"] || row.vendorName || row.Name || "",
        vendorCode: row["Vendor Code"] || row.vendorCode || row.Code || "",
        csiCode: row["CSI Code"] || row.csiCode || row.CSI || "",
      }))
      .filter((r) => r.vendorName && r.csiCode);

    if (mapped.length === 0) {
      toast({
        title: "Import failed",
        description: "Could not find required columns. Expected: Vendor Name, Vendor Code, CSI Code.",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate(
      { projectId, data: { subcontractors: mapped } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
          onOpenChange(false);
          toast({ title: "Import Successful", description: `Imported ${data.imported} subcontractors.` });
        },
      }
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { defval: "" });
        parseRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          parseRows(results.data as Record<string, string>[]);
        },
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium border border-border hover:bg-secondary/80 transition-all">
          <FileUp className="w-4 h-4" /> Import CSV/Excel
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] bg-card p-6 rounded-2xl shadow-xl border border-border text-center">
          <div className="absolute right-4 top-4">
            <Dialog.Close className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileUp className="w-8 h-8 text-primary" />
          </div>
          <Dialog.Title className="text-xl font-display font-bold mb-2">Import Subcontractors</Dialog.Title>
          <p className="text-sm text-muted-foreground mb-6">
            Upload a CSV or Excel (.xlsx) file with columns:{" "}
            <strong>Vendor Name</strong>, <strong>Vendor Code</strong>, and <strong>CSI Code</strong>.
          </p>

          <label className="relative block w-full border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 hover:bg-secondary/50 transition-all cursor-pointer">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
              disabled={mutation.isPending}
            />
            <span className="text-sm font-medium text-primary">
              {mutation.isPending ? "Processing..." : "Click to browse CSV or Excel file"}
            </span>
          </label>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
