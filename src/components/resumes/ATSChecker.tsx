'use client'

import { useMemo, useState } from 'react'
import { generateATSCheck } from '@/actions/resumes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type ATSResult = Awaited<ReturnType<typeof generateATSCheck>>

function scoreVariant(score: number): 'emerald' | 'amber' | 'rose' {
  if (score >= 80) return 'emerald'
  if (score >= 60) return 'amber'
  return 'rose'
}

function fileLooksTextBased(file: File) {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('text/')) return true
  return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.rtf')
}

export function ATSChecker() {
  const [resumeName, setResumeName] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ATSResult | null>(null)

  const canAnalyze = useMemo(() => {
    return resumeText.trim().length > 0 && jobDescription.trim().length > 0 && !isLoading
  }, [resumeText, jobDescription, isLoading])

  async function handleResumeFile(file: File) {
    setResumeName(file.name)

    if (!fileLooksTextBased(file)) {
      toast.error('For ATS analysis, upload a text-based resume file (.txt, .md, .rtf)')
      return
    }

    const text = (await file.text()).trim()
    if (!text) {
      toast.error('Unable to read resume text from the selected file')
      return
    }

    setResumeText(text)
    toast.success('Resume text loaded')
  }

  async function handleAnalyze() {
    try {
      setIsLoading(true)
      const analysis = await generateATSCheck({
        resumeName,
        resumeText,
        jobDescription,
      })
      setResult(analysis)
      toast.success('ATS analysis complete')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to run ATS analysis')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="animate-slide-up">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">ATS Resume Checker</h3>
            <p className="text-sm text-slate-600 mt-1">
              Upload a text-based resume and paste the job description to get an ATS compatibility score.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-slate-600">Upload Resume</p>
            <Input
              type="file"
              accept=".txt,.md,.rtf,text/plain,text/markdown,application/rtf"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void handleResumeFile(file)
                }
              }}
            />
            <p className="text-xs text-slate-500">Supported for analysis: .txt, .md, .rtf</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-slate-600">Resume Text</p>
            <textarea
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              rows={6}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
              placeholder="Resume text appears here after upload. You can edit it before analysis."
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-slate-600">Job Description</p>
          <textarea
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            rows={8}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
            placeholder="Paste the full job description here..."
          />
        </div>

        <div>
          <Button onClick={handleAnalyze} disabled={!canAnalyze}>
            {isLoading ? 'Analyzing...' : 'Run ATS Check'}
          </Button>
        </div>

        {result && (
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              <Badge variant={scoreVariant(result.score)}>ATS Score: {result.score}/100</Badge>
              <p className="text-xs text-slate-500">Provider: {result.provider}</p>
            </div>

            <p className="text-sm text-slate-700">{result.summary}</p>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-slate-600 mb-2">Matched Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {result.keywordMatches.length > 0 ? (
                    result.keywordMatches.map((keyword) => (
                      <Badge key={keyword} variant="teal">
                        {keyword}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">No strong matches found yet.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-600 mb-2">Missing Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {result.missingKeywords.length > 0 ? (
                    result.missingKeywords.map((keyword) => (
                      <Badge key={keyword} variant="amber">
                        {keyword}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600">Great coverage for this role.</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-600 mb-2">Formatting Suggestions</p>
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {result.formattingSuggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium uppercase text-slate-600 mb-2">Actionable Improvements</p>
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {result.actionableSuggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
