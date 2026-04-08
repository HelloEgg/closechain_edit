import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId, projectId } = await request.json()

    if (!documentId || !projectId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Update document status
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to approve document' }, { status: 500 })
    }

    // Update project document counts
    const { data: projectDocs } = await supabase
      .from('documents')
      .select('id, status')
      .eq('project_id', projectId)

    const uploadedCount = projectDocs?.filter(d => d.status === 'uploaded' || d.status === 'approved').length || 0
    const approvedCount = projectDocs?.filter(d => d.status === 'approved').length || 0

    await supabase
      .from('projects')
      .update({
        uploaded_documents: uploadedCount,
        approved_documents: approvedCount,
      })
      .eq('id', projectId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Approve error:', error)
    return NextResponse.json({ error: 'Approval failed' }, { status: 500 })
  }
}
