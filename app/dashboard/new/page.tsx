'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react'
import Image from 'next/image'

interface ProjectInfoData {
  name: string
  jobNumber: string
  endDate: string
  clientName: string
}

interface SubEntry {
  vendorName: string
  vendorCode: string
  csiCode: string
  csiDivision: string
  documentTypes: string[]
  selected: boolean
}

const STEPS = ['Project Info', 'Select Subcontractors', 'Review & Create']

const DEFAULT_SUBS: SubEntry[] = [
  { vendorName: '', vendorCode: '', csiCode: '03', csiDivision: 'Concrete', documentTypes: ['Warranty', 'Manuals', 'Test Reports'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '04', csiDivision: 'Masonry', documentTypes: ['Warranty', 'Manuals'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '05', csiDivision: 'Metals', documentTypes: ['Warranty', 'Manuals', 'Shop Drawings'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '06', csiDivision: 'Wood & Plastics', documentTypes: ['Warranty', 'Manuals'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '07', csiDivision: 'Thermal & Moisture Protection', documentTypes: ['Warranty', 'Manuals', 'Test Reports'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '08', csiDivision: 'Openings', documentTypes: ['Warranty', 'Manuals'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '09', csiDivision: 'Finishes', documentTypes: ['Warranty', 'Manuals'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '21', csiDivision: 'Fire Suppression', documentTypes: ['Warranty', 'Manuals', 'As-Builts', 'Test Reports'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '22', csiDivision: 'Plumbing', documentTypes: ['Warranty', 'Manuals', 'As-Builts'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '23', csiDivision: 'HVAC', documentTypes: ['Warranty', 'Manuals', 'As-Builts', 'Test Reports'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '26', csiDivision: 'Electrical', documentTypes: ['Warranty', 'Manuals', 'As-Builts'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '27', csiDivision: 'Communications', documentTypes: ['Warranty', 'Manuals', 'As-Builts'], selected: false },
  { vendorName: '', vendorCode: '', csiCode: '28', csiDivision: 'Electronic Safety & Security', documentTypes: ['Warranty', 'Manuals', 'As-Builts'], selected: false },
]

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  
  const [projectInfo, setProjectInfo] = useState<ProjectInfoData>({
    name: '',
    jobNumber: '',
    endDate: '',
    clientName: '',
  })

  const [subs, setSubs] = useState<SubEntry[]>(DEFAULT_SUBS)
  const [customSubForm, setCustomSubForm] = useState({ vendorName: '', csiDivision: '' })
  const [showCustomForm, setShowCustomForm] = useState(false)

  const selectedSubs = subs.filter(s => s.selected)

  const handleNext = () => {
    if (step === 0 && !projectInfo.name) {
      alert('Please enter a project name')
      return
    }
    setStep(step + 1)
  }

  const handleBack = () => setStep(step - 1)

  const toggleSub = (idx: number) => {
    setSubs(prev => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s))
  }

  const updateSubVendor = (idx: number, field: string, value: string) => {
    setSubs(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const addCustomSub = () => {
    if (!customSubForm.vendorName.trim() || !customSubForm.csiDivision.trim()) return
    setSubs(prev => [...prev, {
      vendorName: customSubForm.vendorName,
      vendorCode: '',
      csiCode: 'Custom',
      csiDivision: customSubForm.csiDivision,
      documentTypes: ['Warranty', 'Manuals'],
      selected: true,
    }])
    setCustomSubForm({ vendorName: '', csiDivision: '' })
    setShowCustomForm(false)
  }

  const removeCustomSub = (idx: number) => {
    setSubs(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    const validSubs = selectedSubs.filter(s => s.vendorName.trim())
    if (validSubs.length === 0) {
      alert('Please select and name at least one subcontractor')
      return
    }

    setIsCreating(true)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: projectInfo.name,
          job_number: projectInfo.jobNumber || null,
          end_date: projectInfo.endDate || null,
          client_name: projectInfo.clientName || null,
          status: 'in_progress',
        })
        .select()
        .single()

      if (projectError) throw projectError

      // Create subcontractors
      const subcontractors = validSubs.map(s => ({
        project_id: project.id,
        user_id: user.id,
        vendor_name: s.vendorName,
        vendor_code: s.vendorCode || s.csiCode,
        csi_code: s.csiCode,
        csi_division: s.csiDivision,
        total_documents: s.documentTypes.length,
        uploaded_documents: 0,
        approved_documents: 0,
      }))

      const { error: subsError } = await supabase
        .from('subcontractors')
        .insert(subcontractors)

      if (subsError) throw subsError

      router.push('/dashboard')
    } catch (error: any) {
      console.error('Error creating project:', error)
      alert('Failed to create project: ' + error.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Image src="/logo.svg" alt="Closechain AI" width={160} height={40} className="h-10 w-auto" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push('/dashboard')} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-display font-bold">New Project</h1>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                i < step ? 'bg-primary text-white' : i === step ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-secondary text-muted-foreground'
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 md:p-8 mb-6">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-xl font-display font-bold mb-4">Project Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Project Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={projectInfo.name}
                    onChange={e => setProjectInfo({ ...projectInfo, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g., Downtown Office Renovation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Job Number</label>
                  <input
                    value={projectInfo.jobNumber}
                    onChange={e => setProjectInfo({ ...projectInfo, jobNumber: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g., JOB-2026-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Client Name</label>
                  <input
                    value={projectInfo.clientName}
                    onChange={e => setProjectInfo({ ...projectInfo, clientName: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="e.g., ABC Corporation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={projectInfo.endDate}
                    onChange={e => setProjectInfo({ ...projectInfo, endDate: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-display font-bold">Select Subcontractors</h2>
                  <p className="text-sm text-muted-foreground mt-1">Choose trades and enter vendor names.</p>
                </div>
                <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                  {selectedSubs.length} selected
                </span>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {subs.map((sub, idx) => (
                  <div key={idx} className={`rounded-xl border transition-all ${sub.selected ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
                    <div className="flex items-center gap-4 p-4">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={sub.selected}
                          onChange={() => toggleSub(idx)}
                          className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                        />
                        <div>
                          <span className="font-semibold text-foreground">
                            CSI {sub.csiCode} — {sub.csiDivision}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">({sub.documentTypes.length} docs)</span>
                        </div>
                      </label>
                      {sub.selected && sub.csiCode !== 'Custom' && (
                        <input
                          value={sub.vendorName}
                          onChange={e => updateSubVendor(idx, 'vendorName', e.target.value)}
                          placeholder="Vendor name"
                          className="w-48 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      )}
                      {sub.csiCode === 'Custom' && (
                        <button onClick={() => removeCustomSub(idx)} className="text-muted-foreground hover:text-destructive">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                {showCustomForm ? (
                  <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-sm">Add Custom Subcontractor</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={customSubForm.vendorName}
                        onChange={e => setCustomSubForm({ ...customSubForm, vendorName: e.target.value })}
                        placeholder="Vendor Name"
                        className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      />
                      <input
                        value={customSubForm.csiDivision}
                        onChange={e => setCustomSubForm({ ...customSubForm, csiDivision: e.target.value })}
                        placeholder="Trade Type"
                        className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addCustomSub}
                        disabled={!customSubForm.vendorName.trim() || !customSubForm.csiDivision.trim()}
                        className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button onClick={() => setShowCustomForm(false)} className="px-4 py-1.5 text-muted-foreground text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCustomForm(true)}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
                  >
                    <Plus className="w-4 h-4" /> Add Custom Subcontractor
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-display font-bold">Review & Create</h2>
              
              <div className="space-y-4">
                <div className="bg-secondary/30 rounded-xl p-4">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3">Project Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-semibold">{projectInfo.name}</p>
                    </div>
                    {projectInfo.jobNumber && (
                      <div>
                        <span className="text-muted-foreground">Job Number:</span>
                        <p className="font-semibold">{projectInfo.jobNumber}</p>
                      </div>
                    )}
                    {projectInfo.clientName && (
                      <div>
                        <span className="text-muted-foreground">Client:</span>
                        <p className="font-semibold">{projectInfo.clientName}</p>
                      </div>
                    )}
                    {projectInfo.endDate && (
                      <div>
                        <span className="text-muted-foreground">End Date:</span>
                        <p className="font-semibold">{projectInfo.endDate}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-secondary/30 rounded-xl p-4">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3">
                    Subcontractors ({selectedSubs.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedSubs.map((sub, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="font-medium">{sub.vendorName || sub.csiDivision}</span>
                        <span className="text-muted-foreground">CSI {sub.csiCode}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="px-5 py-2.5 rounded-lg font-medium text-muted-foreground hover:bg-secondary disabled:opacity-30 transition-all"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" /> Back
          </button>
          {step < 2 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium shadow-sm hover:bg-primary/90 transition-all"
            >
              Next <ArrowRight className="w-4 h-4 inline ml-2" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isCreating}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Create Project
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
