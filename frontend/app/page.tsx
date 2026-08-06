export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-wide text-ink-500 mb-2">
        Cryptographic Exam Proctoring
      </p>
      <h1 className="text-3xl font-semibold text-ink-900 mb-3">
        Behavioral Integrity Auditor
      </h1>
      <p className="max-w-md text-ink-500 mb-8">
        Keystroke-rhythm anomaly detection and a tamper-evident audit ledger —
        no video, no lockdown, no raw keystrokes ever leave your browser.
      </p>
      <div className="flex gap-3">
        <a
          href="/dashboard"
          className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800 transition-colors"
        >
          Instructor dashboard
        </a>
        <a
          href="/exam/demo-session"
          className="rounded-md border border-ink-100 px-5 py-2.5 text-sm font-medium text-ink-900 hover:bg-ink-50 transition-colors"
        >
          Demo exam session
        </a>
      </div>
    </main>
  );
}
