import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, X } from "lucide-react";
import {
  previewAudience,
  type AudienceConfig,
  type AudiencePreview,
} from "@/lib/campaigns/audience";

interface AudiencePickerProps {
  tenantId: string;
  value: AudienceConfig;
  onChange: (next: AudienceConfig) => void;
}

interface ContactList {
  id: string;
  name: string;
}

export function AudiencePicker({ tenantId, value, onChange }: AudiencePickerProps) {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [includeInput, setIncludeInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const [{ data: listData }, { data: tagData }] = await Promise.all([
        supabase.from("contact_lists").select("id, name").eq("tenant_id", tenantId).order("name"),
        supabase
          .from("contacts")
          .select("tags")
          .eq("tenant_id", tenantId)
          .not("tags", "is", null)
          .limit(2000),
      ]);
      setLists((listData ?? []) as ContactList[]);
      const set = new Set<string>();
      (tagData ?? []).forEach((r) => (r.tags ?? []).forEach((t: string) => set.add(t)));
      setAllTags(Array.from(set).sort());
    })();
  }, [tenantId]);

  // Debounced preview
  useEffect(() => {
    const id = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const result = await previewAudience({ data: value });
        setPreview(result);
      } catch (e) {
        console.error("Audience preview failed", e);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [value]);

  const toggleList = (id: string) => {
    const next = value.listIds.includes(id)
      ? value.listIds.filter((x) => x !== id)
      : [...value.listIds, id];
    onChange({ ...value, listIds: next });
  };

  const addTag = (which: "includeTags" | "excludeTags", tag: string) => {
    const t = tag.trim();
    if (!t) return;
    const arr = value[which];
    if (arr.includes(t)) return;
    onChange({ ...value, [which]: [...arr, t] });
  };

  const removeTag = (which: "includeTags" | "excludeTags", tag: string) => {
    onChange({ ...value, [which]: value[which].filter((t) => t !== tag) });
  };

  return (
    <div className="space-y-5">
      {/* Lists */}
      <div className="space-y-2">
        <Label>Contact lists</Label>
        <p className="text-xs text-muted-foreground">
          Select one or more lists. Leave empty to send to all contacts.
        </p>
        <div className="rounded-md border max-h-44 overflow-auto">
          {lists.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No lists yet.</div>
          ) : (
            lists.map((l) => (
              <label
                key={l.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
              >
                <Checkbox
                  checked={value.listIds.includes(l.id)}
                  onCheckedChange={() => toggleList(l.id)}
                />
                {l.name}
              </label>
            ))
          )}
        </div>
      </div>

      {/* Include tags */}
      <TagInput
        label="Include tags"
        helper="Contacts must have at least one of these tags."
        tags={value.includeTags}
        suggestions={allTags}
        input={includeInput}
        setInput={setIncludeInput}
        onAdd={(t) => {
          addTag("includeTags", t);
          setIncludeInput("");
        }}
        onRemove={(t) => removeTag("includeTags", t)}
      />

      {/* Exclude tags */}
      <TagInput
        label="Exclude tags"
        helper="Contacts with any of these tags are removed."
        tags={value.excludeTags}
        suggestions={allTags}
        input={excludeInput}
        setInput={setExcludeInput}
        onAdd={(t) => {
          addTag("excludeTags", t);
          setExcludeInput("");
        }}
        onRemove={(t) => removeTag("excludeTags", t)}
      />

      {/* Suppress */}
      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox
          checked={value.excludeSuppressed}
          onCheckedChange={(v) => onChange({ ...value, excludeSuppressed: !!v })}
          className="mt-0.5"
        />
        <div>
          <div className="text-sm font-medium">Exclude suppressed contacts</div>
          <div className="text-xs text-muted-foreground">
            Recommended. Skips anyone unsubscribed, bounced, or marked complained.
          </div>
        </div>
      </label>

      {/* Preview */}
      <div className="rounded-md border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          Audience preview
          {previewLoading && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
        </div>
        {preview ? (
          <>
            <div className="text-2xl font-bold">
              {preview.total.toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {preview.total === 1 ? "recipient" : "recipients"}
              </span>
            </div>
            {preview.suppressed > 0 && (
              <div className="text-xs text-muted-foreground">
                {preview.suppressed.toLocaleString()} suppressed{" "}
                {value.excludeSuppressed ? "(excluded)" : "(included)"}
              </div>
            )}
            {preview.sampleEmails.length > 0 && (
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Sample: {preview.sampleEmails.join(", ")}
                {preview.total > preview.sampleEmails.length && "…"}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Calculating…</div>
        )}
      </div>
    </div>
  );
}

function TagInput({
  label,
  helper,
  tags,
  suggestions,
  input,
  setInput,
  onAdd,
  onRemove,
}: {
  label: string;
  helper: string;
  tags: string[];
  suggestions: string[];
  input: string;
  setInput: (s: string) => void;
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
}) {
  const filtered = input
    ? suggestions
        .filter((s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s))
        .slice(0, 6)
    : [];
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{helper}</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1">
            {t}
            <button type="button" onClick={() => onRemove(t)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd(input);
            }
          }}
          placeholder="Type tag and press Enter"
        />
        {filtered.length > 0 && (
          <div className="absolute z-10 left-0 right-0 top-full mt-1 rounded-md border bg-popover shadow-md max-h-40 overflow-auto">
            {filtered.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAdd(s)}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export so other files have a single import surface
export type { AudienceConfig };
export const DEFAULT_AUDIENCE: AudienceConfig = {
  listIds: [],
  includeTags: [],
  excludeTags: [],
  excludeSuppressed: true,
};
