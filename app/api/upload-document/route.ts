import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const subcontractorId = formData.get('subcontractorId') as string
    const documentType = formData.get('documentType') as string

    if (!file || !projectId || !subcontractorId || !documentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upload to Vercel Blob (private storage)
    const blob = await put(`${projectId}/${subcontractorId}/${documentType}/${file.name}`, file, {
      access: 'private',
    })

    // Create document record in database
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        subcontractor_id: subcontractorId,
        user_id: user.id,
        document_type: documentType,
        file_name: file.name,
        file_url: blob.pathname,
        file_size: file.size,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
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

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
