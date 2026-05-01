import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mail, Send, BarChart3, Shield, Users, Zap, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BANTConfirm — Bulk Email Platform for Modern Teams" },
      {
        name: "description",
        content:
          "Send, track, and analyze bulk email campaigns at scale. Multi-tenant, role-based, with built-in analytics and deliverability tools.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Mail className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">BANTConfirm</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">
              Features
            </a>
            <a href="#pricing" className="hover:text-foreground transition">
              Pricing
            </a>
            <a href="#about" className="hover:text-foreground transition">
              About
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                Get started
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-30" aria-hidden>
          <div
            className="absolute -top-40 -right-40 h-96 w-96 rounded-full blur-3xl"
            style={{ background: "var(--gradient-accent)" }}
          />
          <div
            className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full blur-3xl"
            style={{ background: "oklch(0.55 0.15 260)" }}
          />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-3xl text-center text-primary-foreground">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent">
              <Zap className="h-3.5 w-3.5" /> Multi-tenant · Role-based · Built for scale
            </div>
            <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Bulk email,
              <br />
              <span className="text-accent">done right.</span>
            </h1>
            <p className="mt-6 text-lg text-primary-foreground/80 sm:text-xl">
              Build campaigns, manage contacts, and track every open and click — with role-based
              workspaces and a queue that just works.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Start sending free
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-primary-foreground/60">
              Free tier · 1,000 emails/month · No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-4xl font-bold tracking-tight">
            Everything you need to ship campaigns
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From contact upload to deliverability tracking — all in one workspace.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Send,
              title: "Campaign Builder",
              desc: "Drag-and-drop editor, scheduling, A/B subject testing, and audience segmentation.",
            },
            {
              icon: Users,
              title: "Contact Management",
              desc: "Bulk CSV upload, automatic deduplication, tags, and lists.",
            },
            {
              icon: BarChart3,
              title: "Analytics",
              desc: "Open rates, click rates, bounces, daily charts — every metric in real-time.",
            },
            {
              icon: Shield,
              title: "Multi-tenant Security",
              desc: "Workspace isolation, role-based access, and per-tenant suppression lists.",
            },
            {
              icon: Mail,
              title: "Deliverability",
              desc: "Tracking pixels, click redirects, automatic bounce handling, and unsubscribe compliance.",
            },
            {
              icon: Zap,
              title: "Queue-based Sending",
              desc: "Reliable delivery with automatic retries, rate limiting, and batch processing.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border bg-card p-6 transition hover:shadow-lg hover:-translate-y-0.5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-accent group-hover:text-accent-foreground transition">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-secondary/40 border-y">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-4xl font-bold tracking-tight">Simple pricing</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free. Scale when you need to.
            </p>
          </div>
          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {[
              {
                name: "Free",
                price: "$0",
                limit: "1,000 emails/mo",
                features: ["1 workspace", "1 user", "Basic analytics", "Suppression list"],
              },
              {
                name: "Starter",
                price: "$29",
                limit: "25,000 emails/mo",
                features: ["3 users", "Drag-and-drop editor", "A/B testing", "Priority queue"],
                featured: true,
              },
              {
                name: "Pro",
                price: "$99",
                limit: "250,000 emails/mo",
                features: ["Unlimited users", "Webhooks", "Custom domain", "Dedicated support"],
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border bg-card p-8 ${p.featured ? "ring-2 ring-accent shadow-xl scale-[1.02]" : ""}`}
              >
                {p.featured && (
                  <div className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground mb-3">
                    Most popular
                  </div>
                )}
                <h3 className="font-display text-2xl font-bold">{p.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.limit}</p>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className="mt-6 w-full"
                  variant={p.featured ? "default" : "outline"}
                >
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Get started
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8 text-center">
        <h2 className="font-display text-4xl font-bold tracking-tight">
          Ready to send better email?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Set up your workspace in under a minute.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/auth" search={{ mode: "signup" }}>
            Create your workspace
          </Link>
        </Button>
      </section>

      <footer className="border-t bg-secondary/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} BANTConfirm. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
