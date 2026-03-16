import { useState } from "react";
import { useCreateSubcontractor, useImportSubcontractors, type ProjectDetail } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as Dialog from "@radix-ui/react-dialog";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { FileUp, Plus, X, Search, HardHat } from "lucide-react";

export function SubcontractorList({ project }: { project: ProjectDetail }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredSubs = project.subcontractors.filter(sub => 
    sub.vendorName.toLowerCase().includes(search.toLowerCase()) || 
    sub.csiDivision.toLowerCase().includes(search.toLowerCase())
  );

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
          <ImportDialog projectId={project.id} open={isImportOpen} onOpenChange={setIsImportOpen} />
          <AddSubDialog projectId={project.id} open={isAddOpen} onOpenChange={setIsAddOpen} />
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
                </tr>
              ))}
              {filteredSubs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
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

function AddSubDialog({ projectId, open, onOpenChange }: { projectId: number, open: boolean, onOpenChange: (v: boolean) => void }) {
  const mutation = useCreateSubcontractor();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    mutation.mutate({
      projectId,
      data: {
        vendorName: formData.get('vendorName') as string,
        vendorCode: formData.get('vendorCode') as string,
        csiCode: formData.get('csiCode') as string,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
        onOpenChange(false);
        toast({ title: "Subcontractor added", description: "Required documents auto-assigned based on CSI." });
      }
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> Add Subcontractor
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] bg-card p-6 rounded-2xl shadow-xl border border-border">
          <div className="flex justify-between items-start mb-5">
            <Dialog.Title className="text-xl font-display font-bold">Add Subcontractor</Dialog.Title>
            <Dialog.Close className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Vendor Name</label>
              <input name="vendorName" required className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Vendor Code</label>
                <input name="vendorCode" required className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">CSI Code (e.g. 09)</label>
                <input name="csiCode" required className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/50 outline-none" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              The system will automatically assign required closeout documents based on the CSI code provided.
            </p>
            <div className="pt-4 flex justify-end gap-3">
              <button type="submit" disabled={mutation.isPending} className="px-5 py-2 rounded-lg font-medium bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50">
                {mutation.isPending ? "Adding..." : "Add Subcontractor"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ImportDialog({ projectId, open, onOpenChange }: { projectId: number, open: boolean, onOpenChange: (v: boolean) => void }) {
  const mutation = useImportSubcontractors();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const parseRows = (rows: Record<string, string>[]) => {
    const mapped = rows.map((row) => ({
      vendorName: row['Vendor Name'] || row.vendorName || row.Name || '',
      vendorCode: row['Vendor Code'] || row.vendorCode || row.Code || '',
      csiCode: row['CSI Code'] || row.csiCode || row.CSI || '',
    })).filter(r => r.vendorName && r.csiCode);

    if (mapped.length === 0) {
      toast({ title: "Import failed", description: "Could not find required columns. Expected: Vendor Name, Vendor Code, CSI Code.", variant: "destructive" });
      return;
    }

    mutation.mutate({ projectId, data: { subcontractors: mapped } }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
        onOpenChange(false);
        toast({ title: "Import Successful", description: `Imported ${data.imported} subcontractors.` });
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { defval: '' });
        parseRows(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          parseRows(results.data as Record<string, string>[]);
        }
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
            <Dialog.Close className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></Dialog.Close>
          </div>
          
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileUp className="w-8 h-8 text-primary" />
          </div>
          <Dialog.Title className="text-xl font-display font-bold mb-2">Import Subcontractors</Dialog.Title>
          <p className="text-sm text-muted-foreground mb-6">
            Upload a CSV or Excel (.xlsx) file with columns: <strong>Vendor Name</strong>, <strong>Vendor Code</strong>, and <strong>CSI Code</strong>.
          </p>
          
          <label className="relative block w-full border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 hover:bg-secondary/50 transition-all cursor-pointer">
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} disabled={mutation.isPending} />
            <span className="text-sm font-medium text-primary">
              {mutation.isPending ? "Processing..." : "Click to browse CSV or Excel file"}
            </span>
          </label>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
