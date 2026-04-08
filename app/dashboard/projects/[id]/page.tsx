import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProjectDetailsClient from './project-details-client'

export default async function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch project with subcontractors
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) {
    redirect('/dashboard')
  }

  // Fetch subcontractors for this project
  const { data: subcontractors } = await supabase
    .from('subcontractors')
    .select('*')
    .eq('project_id', id)
    .order('csi_code')

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <ProjectDetailsClient project={project} subcontractors={subcontractors || []} user={user} profile={profile} />
}
