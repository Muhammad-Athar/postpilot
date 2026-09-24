import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="text-lg font-semibold tracking-tight">Postpilot</div>
        <Link href="/login" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700">Sign in</Link>
      </header>
      <section className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">AI social content that learns your taste</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Give it an idea, a photo, or a video.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-600">
          It writes and renders platform-native posts and Shorts, learns from every approval, publishes on your schedule, and tells you what actually worked.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login" className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm text-white hover:bg-neutral-700">Try the demo</Link>
          <a href="https://github.com/Muhammad-Athar/postpilot" className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm hover:bg-white">Source on GitHub</a>
        </div>
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            ["Generate", "Two or three candidates per platform, each with its own angle, in your brand voice."],
            ["Review & learn", "Approve, edit, reject with a note, or just ask again. Every choice trains a preference memory."],
            ["Publish & measure", "Scheduled publishing across platforms, then analytics that explain what worked."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="font-medium">{t}</div>
              <p className="mt-1 text-sm text-neutral-600">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
