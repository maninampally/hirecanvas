'use client'

import { useEffect, useMemo, useState } from 'react'
import { 
  generateATSCheck, 
  getUnifiedResumeList, 
  parseResumeFile, 
  parseExistingResume, 
  generateTailoredResumeAction,
  getUserTier,
  type UnifiedResumeRow 
} from '@/actions/resumes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { 
  MdFileUpload, 
  MdLibraryBooks, 
  MdOutlineRefresh, 
  MdAutoFixHigh, 
  MdContentCopy,
  MdClose,
  MdCheckCircle,
  MdLock
} from 'react-icons/md'

type ATSResult = Awaited<ReturnType<typeof generateATSCheck>>
type TailoredResult = Awaited<ReturnType<typeof generateTailoredResumeAction>>

function scoreVariant(score: number): 'emerald' | 'amber' | 'rose' {
  if (score >= 80) return 'emerald'
  if (score >= 60) return 'amber'
  return 'rose'
}

export function ATSChecker() {
  const [resumeName, setResumeName] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isTailoring, setIsTailoring] = useState(false)
  const [result, setResult] = useState<ATSResult | null>(null)
  const [tailoredResult, setTailoredResult] = useState<TailoredResult | null>(null)
  
  const [mode, setMode] = useState<'upload' | 'library'>('upload')
  const [libraryResumes, setLibraryResumes] = useState<UnifiedResumeRow[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  
  const [userTier, setUserTier] = useState<'free' | 'pro' | 'elite' | 'admin'>('free')
  const isElite = useMemo(() => userTier === 'elite' || userTier === 'admin' || userTier === 'pro', [userTier])

  const canAnalyze = useMemo(() => {
    return resumeText.trim().length > 0 && jobDescription.trim().length > 0 && !isLoading && !isParsing
  }, [resumeText, jobDescription, isLoading, isParsing])

  useEffect(() => {
    void getUserTier().then(setUserTier)
    if (mode === 'library') {
      void loadLibraryResumes()
    }
  }, [mode])

  async function loadLibraryResumes() {
    try {
      setLoadingLibrary(true)
      const list = await getUnifiedResumeList()
      setLibraryResumes(list)
    } catch (error) {
      toast.error('Unable to load resume library')
    } finally {
      setLoadingLibrary(false)
    }
  }

  async function handleResumeFile(file: File) {
    try {
      setIsParsing(true)
      setResumeName(file.name)
      const formData = new FormData()
      formData.append('file', file)
      const result = await parseResumeFile(formData)
      setResumeText(result.text)
      toast.success('Resume content extracted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to read resume file')
      setResumeName('')
    } finally {
      setIsParsing(false)
    }
  }

  async function handleSelectLibraryResume(resume: UnifiedResumeRow) {
    try {
      setIsParsing(true)
      setResumeName(resume.kind === 'library' ? resume.name : resume.file_name)
      const result = await parseExistingResume({
        kind: resume.kind,
        id: resume.id
      })
      setResumeText(result.text)
      toast.success('Resume content loaded from library')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load resume from library')
      setResumeName('')
    } finally {
      setIsParsing(false)
    }
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

  async function handleTailor() {
    if (!isElite) {
      toast.error('Resume tailoring is an Elite feature. Please upgrade your plan.')
      return
    }

    try {
      setIsTailoring(true)
      const tailoring = await generateTailoredResumeAction({
        resumeText,
        jobDescription,
      })
      setTailoredResult(tailoring)
      toast.success('Resume tailoring complete')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to tailor resume')
    } finally {
      setIsTailoring(false)
    }
  }

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="space-y-4">
      <Card className="animate-slide-up">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">ATS Resume Checker</h3>
              <p className="text-sm text-slate-600 mt-1">
                Select a resume and paste the job description to get an ATS compatibility score.
              </p>
            </div>
            
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setMode('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <MdFileUpload className="text-sm" />
                Upload New
              </button>
              <button
                onClick={() => setMode('library')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  mode === 'library' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <MdLibraryBooks className="text-sm" />
                From Library
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-slate-600">
                {mode === 'upload' ? 'Upload Resume' : 'Select from Library'}
              </p>
              
              {mode === 'upload' ? (
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/40 transition-colors h-[160px]">
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
                      <span className="text-sm text-slate-500">Extracting text...</span>
                    </div>
                  ) : (
                    <>
                      <MdFileUpload className="text-3xl text-slate-400" />
                      {resumeName ? (
                        <span className="text-sm font-medium text-teal-700">{resumeName}</span>
                      ) : (
                        <span className="text-sm text-slate-500">Click to choose PDF, DOCX, or TXT</span>
                      )}
                      <span className="text-xs text-slate-400">Max 10MB</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.md,.rtf"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) {
                            void handleResumeFile(file)
                          }
                        }}
                      />
                    </>
                  )}
                </label>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 h-[160px] overflow-y-auto space-y-1">
                  {loadingLibrary ? (
                    <div className="flex items-center justify-center h-full gap-2 text-sm text-slate-400">
                      <span className="w-4 h-4 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
                      Loading library...
                    </div>
                  ) : libraryResumes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs text-center px-4">
                      <p>No resumes found in your library.</p>
                      <button onClick={() => setMode('upload')} className="mt-2 text-teal-600 font-medium hover:underline">Upload one now</button>
                    </div>
                  ) : (
                    libraryResumes.map((resume) => {
                      const name = resume.kind === 'library' ? resume.name : resume.file_name
                      const date = new Date(resume.kind === 'library' ? (resume.uploaded_at || resume.created_at) : resume.created_at).toLocaleDateString()
                      return (
                        <button
                          key={resume.id}
                          onClick={() => void handleSelectLibraryResume(resume)}
                          disabled={isParsing}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                            resumeName === name ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'hover:bg-white border border-transparent'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <p className="font-medium truncate">{name}</p>
                            <p className="text-[10px] opacity-60 uppercase">{resume.kind} • {date}</p>
                          </div>
                          {resumeName === name && <Badge variant="teal" className="text-[10px] px-1.5 h-4">Selected</Badge>}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase text-slate-600">Extracted Text</p>
                {isParsing && <span className="text-[10px] text-teal-600 font-medium animate-pulse">Parsing...</span>}
              </div>
              <textarea
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                rows={6}
                className="w-full h-[160px] rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 bg-white"
                placeholder="Resume text will appear here. You can also paste it manually."
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

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleAnalyze} disabled={!canAnalyze} className="flex-1 md:flex-none px-8">
              {isLoading ? 'Analyzing...' : 'Run ATS Check'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setResumeName('')
                setResumeText('')
                setJobDescription('')
                setResult(null)
                setTailoredResult(null)
              }}
              disabled={isLoading || isParsing || isTailoring}
            >
              <MdOutlineRefresh className="mr-2" />
              Clear
            </Button>
          </div>

          {result && (
            <div className="space-y-4 border-t border-slate-200 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant={scoreVariant(result.score)}>ATS Score: {result.score}/100</Badge>
                  <p className="text-xs text-slate-500 italic">Analyzed by {result.provider}</p>
                </div>
                
                <Button 
                  size="sm" 
                  className={`${isElite ? 'bg-teal-600 hover:bg-teal-700' : 'bg-slate-400 hover:bg-slate-500'} text-white rounded-full px-4 h-8 transition-all`}
                  onClick={handleTailor}
                  disabled={isTailoring}
                >
                  {isTailoring ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Tailoring...
                    </>
                  ) : (
                    <>
                      {isElite ? <MdAutoFixHigh className="mr-2" /> : <MdLock className="mr-2" />}
                      Tailor My Resume
                      {!isElite && <span className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase font-bold">Elite</span>}
                    </>
                  )}
                </Button>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Matched Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {result.keywordMatches.length > 0 ? (
                      result.keywordMatches.map((keyword) => (
                        <Badge key={keyword} variant="teal" className="rounded-md font-normal">
                          {keyword}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic">No strong matches found.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Missing Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {result.missingKeywords.length > 0 ? (
                      result.missingKeywords.map((keyword) => (
                        <Badge key={keyword} variant="amber" className="rounded-md font-normal">
                          {keyword}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic">No major keywords missing.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Formatting Suggestions</p>
                  <ul className="space-y-2">
                    {result.formattingSuggestions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Actionable Improvements</p>
                  <ul className="space-y-2">
                    {result.actionableSuggestions.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tailored Resume Result ── */}
      {tailoredResult && (
        <Card className="border-teal-100 bg-teal-50/20 animate-in zoom-in-95 duration-300">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-teal-900 flex items-center gap-2">
                <MdCheckCircle className="text-emerald-500" />
                Tailored Resume Draft
              </CardTitle>
              <p className="text-xs text-teal-700 mt-1">{tailoredResult.matchExplanation}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setTailoredResult(null)} className="text-teal-600">
              <MdClose className="text-lg" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600">Key Optimizations</p>
                <ul className="space-y-2">
                  {tailoredResult.changesMade.map((change, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="mt-1 text-teal-500">•</span>
                      {change}
                    </li>
                  ))}
                </ul>
                <div className="pt-4 space-y-2">
                  <Button 
                    className="w-full bg-teal-600 hover:bg-teal-700" 
                    onClick={() => copyToClipboard(tailoredResult.tailoredText)}
                  >
                    <MdContentCopy className="mr-2" />
                    Copy Content
                  </Button>
                  <p className="text-[10px] text-center text-slate-400">
                    Paste this into your resume template to finalize.
                  </p>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <div className="rounded-xl border border-teal-100 bg-white p-4 h-[400px] overflow-y-auto shadow-inner">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed">
                    {tailoredResult.tailoredText}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
