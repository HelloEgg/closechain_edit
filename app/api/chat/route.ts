import { streamText, tool } from 'ai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { messages, projectId } = await req.json()
  const supabase = await createClient()

  // Get project details and documents
  const { data: project } = await supabase
    .from('projects')
    .select('*, subcontractors(*)')
    .eq('id', projectId)
    .single()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    system: `You are an AI assistant for Closechain AI, a construction closeout package management system.
    
You have access to the following project information:
- Project Name: ${project?.name || 'Unknown'}
- Client: ${project?.client_name || 'Unknown'}
- Job Number: ${project?.job_number || 'Unknown'}
- End Date: ${project?.end_date || 'Unknown'}
- Status: ${project?.status || 'Unknown'}
- Number of Subcontractors: ${project?.subcontractors?.length || 0}
- Total Documents Expected: ${project?.total_documents || 0}
- Uploaded Documents: ${project?.uploaded_documents || 0}
- Approved Documents: ${project?.approved_documents || 0}
- Completion Percentage: ${project?.total_documents > 0 ? Math.round(((project?.uploaded_documents || 0) / project.total_documents) * 100) : 0}%

Subcontractors:
${project?.subcontractors?.map((s: any) => `- ${s.csi_division} (${s.vendor_name}): ${s.received_docs}/${s.total_docs} documents`).join('\n') || 'None'}

Documents:
${documents?.map((d: any) => `- ${d.document_type} for subcontractor ${d.subcontractor_id}: ${d.status} (${d.file_name})`).join('\n') || 'No documents uploaded yet'}

Answer questions about:
- Project completion status and progress
- Document status and requirements
- Subcontractor progress
- File contents and document details
- Overall project metrics

Be helpful, concise, and professional.`,
    messages,
    tools: {
      getProjectStats: tool({
        description: 'Get detailed statistics about the project completion',
        inputSchema: z.object({}),
        execute: async () => ({
          totalDocs: project?.total_documents || 0,
          uploadedDocs: project?.uploaded_documents || 0,
          approvedDocs: project?.approved_documents || 0,
          completionPercentage: project?.total_documents > 0 
            ? Math.round(((project?.uploaded_documents || 0) / project.total_documents) * 100)
            : 0,
          subcontractorCount: project?.subcontractors?.length || 0,
        }),
      }),
      getSubcontractorDetails: tool({
        description: 'Get detailed information about specific subcontractors',
        inputSchema: z.object({
          subcontractorId: z.string().nullable(),
        }),
        execute: async ({ subcontractorId }) => {
          if (subcontractorId) {
            const sub = project?.subcontractors?.find((s: any) => s.id === subcontractorId)
            return sub || { error: 'Subcontractor not found' }
          }
          return project?.subcontractors || []
        },
      }),
      getDocumentDetails: tool({
        description: 'Get information about uploaded documents',
        inputSchema: z.object({
          documentType: z.string().nullable(),
        }),
        execute: async ({ documentType }) => {
          if (documentType) {
            return documents?.filter((d: any) => d.document_type === documentType) || []
          }
          return documents || []
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
