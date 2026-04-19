import { type LucideIcon } from "lucide-react";

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ComingSoon({ icon: Icon, title, description }: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
        </div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-muted-foreground">{description}</p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent/15 px-4 py-1.5 text-xs font-medium text-accent-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Coming in upcoming phases
        </div>
      </div>
    </div>
  );
}
