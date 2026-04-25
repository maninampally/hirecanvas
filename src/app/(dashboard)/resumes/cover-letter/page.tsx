'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { generateCoverLetterDraft, getResumes, type ResumeItem } from '@/actions/resumes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { TierGate } from '@/components/ui/TierGate'
import { UpgradeModal } from '@/components/auth/UpgradeModal'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'

type Tone = 'professional' | 'conversational' | 'creative'

export default function CoverLetterPage() {
  const { user } = useAuthStore()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [resumes, setResumes] = useState<ResumeItem[]>([])
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [resumeId, setResumeId] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [result, setResult] = useState<{
    letter: string
    provider: string
    model: string
    fallbackCount: number
  } | null>(null)

  useEffect(() => {
    const loadResumes = async () => {
      setLoadingResumes(true)
      try {
        const data = await getResumes()
        setResumes(data)

        const defaultResume = data.find((item) => item.is_default) || data[0]
        if (defaultResume) setResumeId(defaultResume.id)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load resumes')
      } finally {
        setLoadingResumes(false)
      }
    }

    void loadResumes()
  }, [])

  const handleGenerate = async () => {
    if (!resumeId) {
      toast.error('Please select a resume')
      return
    }

    if (!jobDescription.trim()) {
      toast.error('Please paste a job description')
      return
    }

    setGenerating(true)
    try {
      const response = await generateCoverLetterDraft({
        resumeId,
        jobTitle,
        company,
        jobDescription,
        tone,
      })

      setResult(response)
      toast.success('Cover letter draft generated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate cover letter')
    } finally {
      setGenerating(false)
    }
  }

  const upgradeFallback = (
    <Card>
      <CardContent className="py-12 text-center space-y-4">
        <p className="text-2xl">✍️</p>
        <h3 className="text-lg font-semibold text-slate-900">Elite feature</h3>
        <p className="text-sm text-slate-600 max-w-sm mx-auto">
          AI Cover Letter Writer generates tailored drafts from your resume and a job description. Available on Elite plan.
        </p>
        <Button onClick={() => setShowUpgrade(true)}>Upgrade to Elite</Button>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 animate-slide-up">
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature="cover_letter" />

      <PageHeader
        title="AI Cover Letter Writer"
        description="Generate tailored cover letters from your resume and a job description"
      >
        <Link href="/resumes">
          <Button variant="outline">Back to Resumes</Button>
        </Link>
      </PageHeader>

      <TierGate currentTier={user?.tier} allowedTiers={['elite', 'admin']} fallback={upgradeFallback}>
        <Card>
          <CardHeader>
            <CardTitle>Draft Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={resumeId}
                onChange={(event) => setResumeId(event.target.value)}
                disabled={loadingResumes || resumes.length === 0}
              >
                {resumes.length === 0 && <option value="">No resumes uploaded</option>}
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.name} {resume.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </Select>

              <Select value={tone} onChange={(event) => setTone(event.target.value as Tone)}>
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="creative">Creative</option>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Job title"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
              />
              <Input
                placeholder="Company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>

            <textarea
              className="min-h-48 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
            />

            <div className="flex justify-end">
              <Button onClick={() => void handleGenerate()} disabled={generating || loadingResumes}>
                {generating ? 'Generating...' : 'Generate Cover Letter'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card className="animate-slide-up delay-150">
            <CardHeader>
              <CardTitle>Generated Draft</CardTitle>
              <p className="text-xs text-slate-500">
                Provider: {result.provider} ({result.model}) • Fallbacks used: {result.fallbackCount}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="min-h-80 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                value={result.letter}
                onChange={(event) =>
                  setResult((prev) => (prev ? { ...prev, letter: event.target.value } : prev))
                }
              />
            </CardContent>
          </Card>
        )}
      </TierGate>
    </div>
  )
}
