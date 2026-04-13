import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClientPortalClient from './client-portal-client'

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // Fetch project by token
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('client_portal_token', token)
    .eq('is_published', true)
    .single()

  if (projectError || !project) {
    notFound()
  }

  // Fetch subcontractors
  const { data: subcontractors } = await supabase
    .from('subcontractors')
    .select('*')
    .eq('project_id', project.id)
    .order('csi_division', { ascending: true })

  // Fetch documents
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', project.id)

  return (
    <ClientPortalClient
      project={project}
      subcontractors={subcontractors || []}
      documents={documents || []}
      token={token}
    />
  )
}
