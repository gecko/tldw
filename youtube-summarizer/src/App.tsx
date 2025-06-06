import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useSearchParams,
} from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

interface Summary {
  word: string;
  sentence: string;
  paragraph: string;
  wikipedia: string;
}

interface ResponseData {
  success: boolean;
  error: string;
  video_id: string;
  title: string;
  thumbnail_url: string;
  webpage_url: string;
  aspect_ratio: number;
  summary: Summary;
}

interface VideoInfo {
  video_id: string;
  title: string;
  thumbnail_url: string;
  aspect_ratio: number;
  webpage_url: string;
}

const getApiBaseUrl = () => {
  return window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://api.tldw.tube';
};

function VideoSummary() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [followupQuestion, setFollowupQuestion] = useState("");
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupError, setFollowupError] = useState("");
  const [followupAnswer, setFollowupAnswer] = useState("");

  // Handle URL changes (including back/forward navigation)
  useEffect(() => {
    const videoId = searchParams.get('v');
    const currentVideoId = (videoInfo && videoInfo.video_id) || ''
    if (videoId) {
      if (videoId != currentVideoId) {
        const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
        if (!videoInfo || !summary || fullUrl != url) {
          setUrl(fullUrl);
          handleSummarize(fullUrl);
        }
      }
    } else {
      // Clear state when no video ID is present
      setSummary(null);
      setVideoInfo(null);
    }
  }, [searchParams]);

  const handleSummarize = async (videoUrl: string) => {
    setLoading(true);
    setError('');
    setSummary(null);
    setVideoInfo(null);

    try {

      const response = await fetch(`${getApiBaseUrl()}/api/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      const data: ResponseData = await response.json();

      // Update url with id
      if (data && data.video_id) {
        const currentSearchParam = searchParams.get('v');
        if (currentSearchParam != data.video_id) {
          setSearchParams({ v: data.video_id });
        }
      }

      if (!response.ok) {
        throw new Error((data && data.error) || 'Failed to get summary');
      }

      setSummary(data.summary);

      const videoInfo: VideoInfo = {
        video_id: data.video_id,
        title: data.title,
        thumbnail_url: data.thumbnail_url,
        aspect_ratio: data.aspect_ratio,
        webpage_url: data.webpage_url
      };
      setUrl(data.webpage_url);
      setVideoInfo(videoInfo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoInfo || videoInfo.webpage_url != url) {
      await handleSummarize(url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 dark:text-zinc-200 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="pb-12">
          <h1 className="text-4xl font-bold text-center mb-12"><a href="/">TL;DW - Summarize a YouTube Video for me</a></h1>
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex justify-center gap-2 mb-8">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube URL here..."
              className="flex-1 max-w-xl px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:focus:ring-blue-600 dark:placeholder:text-zinc-500"
              autoFocus
            />
            <button
              type="submit"
              title="Summarize"
              disabled={loading || !url}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
            >
              <ArrowRight size={20} />
            </button>
          </form>

          {/* Loading State */}
          {loading && (
            <div className="text-center text-gray-500 dark:text-zinc-400">
              Analyzing video...
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-center text-red-500 dark:text-red-600 mb-8">
              {error}
            </div>
          )}

          {/* Results */}
          {summary && !loading && videoInfo && (
            <div className="space-y-8">
              {/* Video title and thumbnail */}
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">{videoInfo.title}</h2>
                <div style={{ position: 'relative', width: '100%', paddingBottom: `${(1 / videoInfo.aspect_ratio) * 100}%` }}>
                  <iframe
                    src={"https://www.youtube.com/embed/" + videoInfo.video_id}
                    style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}
                    title={videoInfo.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>

              {/* Word and Sentence Summary */}
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">{summary.word} <a href={summary.wikipedia}><img className="inline-block h-8 w-8" src="/wikipedia.svg" alt="Wikipedia Logo"/></a></h2>
                <p className="text-lg text-justify hyphens-auto">{summary.sentence}</p>
              </div>

              {/* Paragraph Summary */}
              <div>
                <h2 className="text-2xl font-bold mb-2">Full summary</h2>
                <div className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown>{summary.paragraph}</ReactMarkdown>
                </div>
              </div>
              {/* Follow-up Question Section */}
              <div className="pt-6 border-t border-gray-200 dark:border-zinc-700">
                <form
                  className="flex flex-col gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!followupQuestion.trim()) return;
                    setFollowupLoading(true);
                    setFollowupError("");
                    setFollowupAnswer("");
                    try {
                      const response = await fetch(`${getApiBaseUrl()}/api/chat`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          video_id: videoInfo.video_id,
                          question: followupQuestion,
                        }),
                      });
                      const data = await response.json();
                      if (!response.ok) {
                        throw new Error((data && data.error) || "Failed to get answer");
                      }
                      setFollowupAnswer(data.answer || "No answer returned.");
                    } catch (err: any) {
                      setFollowupError(err.message);
                    } finally {
                      setFollowupLoading(false);
                    }
                  }}
                >
                  <label className="font-semibold" htmlFor="followup">Ask a follow-up question about this video:</label>
                  <div className="flex gap-2">
                    <input
                      id="followup"
                      type="text"
                      value={followupQuestion}
                      onChange={e => setFollowupQuestion(e.target.value)}
                      placeholder="Type your question..."
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:focus:ring-blue-600 dark:placeholder:text-zinc-500"
                      disabled={followupLoading}
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                      disabled={followupLoading || !followupQuestion.trim()}
                    >
                      Ask
                    </button>
                  </div>
                </form>
                {followupLoading && (
                  <div className="text-blue-500 mt-2">Thinking...</div>
                )}
                {followupError && (
                  <div className="text-red-500 mt-2">{followupError}</div>
                )}
                {followupAnswer && !followupLoading && !followupError && (
                  <div className="mt-4 p-4 rounded-lg bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                    <span className="font-semibold">Answer:</span> <div className="prose dark:prose-invert max-w-none inline"><ReactMarkdown children={followupAnswer} /></div>
                  </div>
                )}
              </div>
              {/* End Follow-up Section */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrapper component for React Router
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<VideoSummary />} />
      </Routes>
    </Router>
  );
}
