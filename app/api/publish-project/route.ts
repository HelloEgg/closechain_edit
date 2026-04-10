import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, publish } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (publish) {
      // Generate token if not exists
      const token = project.client_portal_token || randomBytes(32).toString('hex')
      
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          is_published: true,
          client_portal_token: token
        })
        .eq('id', projectId)

      if (updateError) throw updateError

      return NextResponse.json({ 
        success: true, 
        is_published: true,
        client_portal_token: token
      })
    } else {
      // Unpublish but keep the token
      const { error: updateError } = await supabase
        .from('projects')
        .update({ is_published: false })
        .eq('id', projectId)

      if (updateError) throw updateError

      return NextResponse.json({ 
        success: true, 
        is_published: false,
        client_portal_token: project.client_portal_token
      })
    }
  } catch (error) {
    console.error('Publish error:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}
