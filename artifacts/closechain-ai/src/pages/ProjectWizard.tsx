import { useState, useMemo } from "react";
import { useSetupProject, useListCsiDivisions, type CsiDivision } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Plus, X, ChevronDown, ChevronUp, Search } from "lucide-react";
import { DocumentTypeCombobox } from "@/components/DocumentTypeCombobox";

interface ProjectInfoData {
  name: string;
  jobNumber: string;
  endDate: string;
  description: string;
}

interface SubEntry {
  vendorName: string;
  vendorCode: string;
  csiCode: string;
  csiDivision: string;
  documentTypes: string[];
  selected: boolean;
}

interface StepSelectSubsProps {
  subs: SubEntry[];
  onToggle: (idx: number) => void;
  onUpdateVendor: (idx: number, field: string, value: string) => void;
  showCustomForm: boolean;
  setShowCustomForm: (v: boolean) => void;
  customSubForm: { vendorName: string; vendorCode: string; csiCode: string };
  setCustomSubForm: (v: { vendorName: string; vendorCode: string; csiCode: string }) => void;
  onAddCustom: () => void;
  onRemoveCustom: (idx: number) => void;
}

interface StepCustomizeDocsProps {
  subs: SubEntry[];
  allSubs: SubEntry[];
  setSubs: React.Dispatch<React.SetStateAction<SubEntry[]>>;
  csiDivisions: CsiDivision[];
  onToggleDoc: (subIdx: number, doc: string) => void;
  onAddCustomDoc: (subIdx: number, doc: string) => void;
}

const STEPS = ["Project Info", "Select Subcontractors", "Customize Documents", "Review & Create"];

export default function ProjectWizard() {
  const [step, setStep] = useState(0);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const setupMutation = useSetupProject();
  const { data: csiDivisions } = useListCsiDivisions();

  const [projectInfo, setProjectInfo] = useState({
    name: "",
    jobNumber: "",
    endDate: "",
    description: "",
  });

  const [subs, setSubs] = useState<SubEntry[]>([]);
  const [customSubForm, setCustomSubForm] = useState({ vendorName: "", vendorCode: "", csiCode: "" });
  const [showCustomForm, setShowCustomForm] = useState(false);

  const initSubsFromCSI = () => {
    if (!csiDivisions) return;
    const defaultSubs = csiDivisions.map((div) => ({
      vendorName: "",
      vendorCode: "",
      csiCode: div.code,
      csiDivision: div.name,
      documentTypes: div.requiredDocuments.map((r) => r.documentType),
      selected: false,
    }));
    setSubs(defaultSubs);
  };

  const handleNext = () => {
    if (step === 0) {
      if (!projectInfo.name) {
        toast({ title: "Please enter a project name", variant: "destructive" });
        return;
      }
      if (subs.length === 0) initSubsFromCSI();
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const toggleSub = (idx: number) => {
    setSubs(prev => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s));
  };

  const updateSubVendor = (idx: number, field: string, value: string) => {
    setSubs(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const toggleDoc = (subIdx: number, doc: string) => {
    setSubs(prev => prev.map((s, i) => {
      if (i !== subIdx) return s;
      const has = s.documentTypes.includes(doc);
      return { ...s, documentTypes: has ? s.documentTypes.filter(d => d !== doc) : [...s.documentTypes, doc] };
    }));
  };

  const addCustomDoc = (subIdx: number, doc: string) => {
    setSubs(prev => prev.map((s, i) => {
      if (i !== subIdx) return s;
      return { ...s, documentTypes: [...s.documentTypes, doc] };
    }));
  };

  const addCustomSub = () => {
    if (!customSubForm.vendorName || !customSubForm.csiCode) return;
    const division = csiDivisions?.find(d => d.code === customSubForm.csiCode);
    setSubs(prev => [...prev, {
      ...customSubForm,
      csiCode: customSubForm.csiCode,
      csiDivision: division?.name || "Custom",
      documentTypes: division?.requiredDocuments ? division.requiredDocuments.map((r) => r.documentType) : [],
      selected: true,
    }]);
    setCustomSubForm({ vendorName: "", vendorCode: "", csiCode: "" });
    setShowCustomForm(false);
  };

  const removeCustomSub = (idx: number) => {
    setSubs(prev => prev.filter((_, i) => i !== idx));
  };

  const selectedSubs = subs.filter(s => s.selected);

  const handleSubmit = () => {
    const validSubs = selectedSubs.filter(s => s.vendorName.trim());
    if (validSubs.length === 0) {
      toast({ title: "Please select and name at least one subcontractor", variant: "destructive" });
      return;
    }

    setupMutation.mutate({
      data: {
        name: projectInfo.name,
        jobNumber: projectInfo.jobNumber || undefined,
        endDate: projectInfo.endDate || undefined,
        description: projectInfo.description || undefined,
        subcontractors: validSubs.map(s => ({
          vendorName: s.vendorName,
          vendorCode: s.vendorCode || s.csiCode,
          csiCode: s.csiCode,
          documentTypes: s.documentTypes,
        })),
      }
    }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        toast({ title: "Project created successfully!" });
        navigate(`/projects/${data.id}`);
      },
      onError: (err) => {
        toast({ title: "Failed to create project", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-display font-bold">New Project</h1>
        </div>

        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                i < step ? "bg-primary text-white" : i === step ? "bg-primary text-white ring-4 ring-primary/20" : "bg-secondary text-muted-foreground"
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8">
          {step === 0 && <StepProjectInfo info={projectInfo} onChange={setProjectInfo} />}
          {step === 1 && <StepSelectSubs subs={subs} onToggle={toggleSub} onUpdateVendor={updateSubVendor} showCustomForm={showCustomForm} setShowCustomForm={setShowCustomForm} customSubForm={customSubForm} setCustomSubForm={setCustomSubForm} onAddCustom={addCustomSub} onRemoveCustom={removeCustomSub} />}
          {step === 2 && <StepCustomizeDocs subs={selectedSubs} allSubs={subs} setSubs={setSubs} csiDivisions={csiDivisions || []} onToggleDoc={toggleDoc} onAddCustomDoc={addCustomDoc} />}
          {step === 3 && <StepReview projectInfo={projectInfo} subs={selectedSubs} />}
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="px-5 py-2.5 rounded-lg font-medium text-muted-foreground hover:bg-secondary disabled:opacity-30 transition-all"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" /> Back
          </button>
          {step < 3 ? (
            <button onClick={handleNext} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-all">
              Next <ArrowRight className="w-4 h-4 inline ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={setupMutation.isPending}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {setupMutation.isPending ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</>
              ) : (
                <><Check className="w-4 h-4" /> Create Project</>
              )}
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function StepProjectInfo({ info, onChange }: { info: ProjectInfoData, onChange: (v: ProjectInfoData) => void }) {
  const update = (field: keyof ProjectInfoData, value: string) => onChange({ ...info, [field]: value });

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-display font-bold mb-4">Project Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Project Name <span className="text-destructive">*</span></label>
          <input value={info.name} onChange={e => update("name", e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="e.g., Downtown Office Reno" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Job Number</label>
          <input value={info.jobNumber} onChange={e => update("jobNumber", e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="e.g., JOB-2026-001" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">End Date</label>
          <input type="date" value={info.endDate} onChange={e => update("endDate", e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
          <textarea value={info.description} onChange={e => update("description", e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" placeholder="Brief project details..." />
        </div>
      </div>
    </div>
  );
}

function StepSelectSubs({ subs, onToggle, onUpdateVendor, showCustomForm, setShowCustomForm, customSubForm, setCustomSubForm, onAddCustom, onRemoveCustom }: StepSelectSubsProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSubs = useMemo(() => {
    if (!searchQuery.trim()) return subs.map((sub, idx) => ({ sub, idx }));
    const q = searchQuery.toLowerCase();
    return subs
      .map((sub, idx) => ({ sub, idx }))
      .filter(({ sub }) =>
        sub.csiDivision.toLowerCase().includes(q) ||
        sub.csiCode.toLowerCase().includes(q) ||
        sub.vendorName.toLowerCase().includes(q)
      );
  }, [subs, searchQuery]);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-display font-bold">Select Subcontractors</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose trades applicable to this project. Enter vendor names for each selected trade.</p>
        </div>
        <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">{subs.filter((s: SubEntry) => s.selected).length} selected</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by trade name or CSI code..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredSubs.map(({ sub, idx }) => (
          <div key={idx} className={`rounded-xl border transition-all ${sub.selected ? "border-primary/30 bg-primary/5" : "border-border hover:border-border/80"}`}>
            <div className="flex items-center gap-4 p-4">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input type="checkbox" checked={sub.selected} onChange={() => onToggle(idx)} className="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                <div>
                  <span className="font-semibold text-foreground">{sub.csiCode} — {sub.csiDivision}</span>
                  <span className="text-xs text-muted-foreground ml-2">({sub.documentTypes.length} docs)</span>
                </div>
              </label>
              {sub.selected && (
                <input
                  value={sub.vendorName}
                  onChange={e => onUpdateVendor(idx, "vendorName", e.target.value)}
                  placeholder="Vendor name"
                  className="w-48 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              )}
              {sub.csiDivision === "Custom" && (
                <button onClick={() => onRemoveCustom(idx)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-4">
        {showCustomForm ? (
          <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-sm">Add Custom Subcontractor</h4>
            <div className="grid grid-cols-3 gap-3">
              <input value={customSubForm.vendorName} onChange={e => setCustomSubForm({ ...customSubForm, vendorName: e.target.value })} placeholder="Vendor Name" className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
              <input value={customSubForm.vendorCode} onChange={e => setCustomSubForm({ ...customSubForm, vendorCode: e.target.value })} placeholder="Vendor Code" className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
              <input value={customSubForm.csiCode} onChange={e => setCustomSubForm({ ...customSubForm, csiCode: e.target.value })} placeholder="CSI Code (e.g. 260000)" className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={onAddCustom} className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium">Add</button>
              <button onClick={() => setShowCustomForm(false)} className="px-4 py-1.5 text-muted-foreground text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowCustomForm(true)} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80">
            <Plus className="w-4 h-4" /> Add Custom Subcontractor
          </button>
        )}
      </div>
    </div>
  );
}

function StepCustomizeDocs({ subs, allSubs, setSubs, csiDivisions, onToggleDoc, onAddCustomDoc }: StepCustomizeDocsProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const allDocumentTypes = useMemo(() => {
    const set = new Set<string>();
    csiDivisions.forEach((d: CsiDivision) => {
      d.requiredDocuments.forEach((r) => set.add(r.documentType));
    });
    return Array.from(set).sort();
  }, [csiDivisions]);

  const getOriginalIdx = (sub: SubEntry) => allSubs.findIndex((s: SubEntry) => s === sub);

  const csiDocsGrouped = useMemo(() => {
    const map: Record<string, { standalone: string[]; parentMap: Record<string, string[]> }> = {};
    csiDivisions.forEach((d: CsiDivision) => {
      const standalone: string[] = [];
      const parentMap: Record<string, string[]> = {};
      for (const r of d.requiredDocuments) {
        if (r.parentDocumentType) {
          if (!parentMap[r.parentDocumentType]) parentMap[r.parentDocumentType] = [];
          parentMap[r.parentDocumentType].push(r.documentType);
        } else {
          standalone.push(r.documentType);
        }
      }
      map[d.code] = { standalone, parentMap };
    });
    return map;
  }, [csiDivisions]);

  const csiAllDocsFlat = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    csiDivisions.forEach((d: CsiDivision) => {
      map[d.code] = new Set(d.requiredDocuments.map((r) => r.documentType));
    });
    return map;
  }, [csiDivisions]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-display font-bold">Customize Required Documents</h2>
        <p className="text-sm text-muted-foreground mt-1">Toggle documents on/off for each subcontractor, or add custom requirements.</p>
      </div>

      <div className="space-y-3">
        {subs.map((sub: SubEntry, localIdx: number) => {
          const origIdx = getOriginalIdx(sub);
          const isExpanded = expandedIdx === localIdx;
          const grouped = csiDocsGrouped[sub.csiCode] || { standalone: [], parentMap: {} };
          const knownDocs = csiAllDocsFlat[sub.csiCode] || new Set<string>();
          const customDocs = sub.documentTypes.filter((d) => !knownDocs.has(d));

          return (
            <div key={origIdx} className="rounded-xl border border-border overflow-hidden">
              <div onClick={() => setExpandedIdx(isExpanded ? null : localIdx)} className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors">
                <div>
                  <span className="font-semibold text-foreground">{sub.vendorName || sub.csiDivision}</span>
                  <span className="text-xs text-muted-foreground ml-2">CSI {sub.csiCode} — {sub.documentTypes.length} docs</span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
              {isExpanded && (
                <div className="border-t border-border p-4 bg-background space-y-1">
                  {grouped.standalone.map(doc => (
                    <label key={doc} className="flex items-center gap-3 py-1.5 cursor-pointer rounded-lg hover:bg-secondary/50 transition-colors px-1">
                      <input type="checkbox" checked={sub.documentTypes.includes(doc)} onChange={() => onToggleDoc(origIdx, doc)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                      <span className="text-sm text-foreground">{doc}</span>
                    </label>
                  ))}
                  {Object.entries(grouped.parentMap).map(([parent, children]) => (
                    <div key={parent} className="mt-1">
                      <div className="flex items-center gap-2 py-1 px-1">
                        <div className="w-1 h-4 bg-primary/30 rounded-full shrink-0" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{parent}</span>
                      </div>
                      {children.map((doc) => (
                        <label key={doc} className="flex items-center gap-3 py-1.5 pl-5 pr-1 cursor-pointer rounded-lg hover:bg-secondary/50 transition-colors">
                          <input type="checkbox" checked={sub.documentTypes.includes(doc)} onChange={() => onToggleDoc(origIdx, doc)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                          <span className="text-sm text-foreground">{doc}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                  {customDocs.map(doc => (
                    <label key={doc} className="flex items-center gap-3 py-1.5 cursor-pointer rounded-lg hover:bg-secondary/50 transition-colors px-1">
                      <input type="checkbox" checked={sub.documentTypes.includes(doc)} onChange={() => onToggleDoc(origIdx, doc)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
                      <span className="text-sm text-foreground">{doc}</span>
                      <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">custom</span>
                    </label>
                  ))}
                  <div className="mt-3 pt-3 border-t border-border">
                    <DocumentTypeCombobox
                      allDocumentTypes={allDocumentTypes}
                      selectedDocumentTypes={sub.documentTypes}
                      onAdd={(docType) => onAddCustomDoc(origIdx, docType)}
                      placeholder="Add document type..."
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepReview({ projectInfo, subs }: { projectInfo: ProjectInfoData, subs: SubEntry[] }) {
  const totalDocs = subs.reduce((sum, s) => sum + s.documentTypes.length, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-bold">Review & Create</h2>

      <div className="bg-secondary/50 rounded-xl p-5 space-y-2">
        <h3 className="font-semibold text-foreground">Project Details</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="text-muted-foreground">Name:</span> {projectInfo.name}</p>
          {projectInfo.jobNumber && <p><span className="text-muted-foreground">Job #:</span> {projectInfo.jobNumber}</p>}
          {projectInfo.endDate && <p><span className="text-muted-foreground">End Date:</span> {projectInfo.endDate}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm font-medium">
        <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-full">{subs.length} Subcontractors</span>
        <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">{totalDocs} Document Slots</span>
      </div>

      <div className="space-y-3">
        {subs.filter(s => s.vendorName.trim()).map((sub, idx) => (
          <div key={idx} className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-semibold text-foreground">{sub.vendorName}</span>
                <span className="text-xs text-muted-foreground ml-2">CSI {sub.csiCode} — {sub.csiDivision}</span>
              </div>
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">{sub.documentTypes.length} docs</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sub.documentTypes.map(doc => (
                <span key={doc} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md">{doc}</span>
              ))}
            </div>
          </div>
        ))}

        {subs.filter(s => !s.vendorName.trim()).length > 0 && (
          <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            {subs.filter(s => !s.vendorName.trim()).length} selected subcontractor(s) have no vendor name and will be skipped.
          </div>
        )}
      </div>
    </div>
  );
}
