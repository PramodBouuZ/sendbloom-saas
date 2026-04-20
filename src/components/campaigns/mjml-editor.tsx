import { useEffect, useRef } from "react";
import grapesjs, { type Editor } from "grapesjs";
import grapesjsMjml from "grapesjs-mjml";
import "grapesjs/dist/css/grapes.min.css";

interface MjmlEditorProps {
  value: string;
  onChange: (mjml: string, html: string) => void;
}

const DEFAULT_MJML = `<mjml>
  <mj-body background-color="#f4f4f5">
    <mj-section background-color="#ffffff" padding="32px">
      <mj-column>
        <mj-text font-size="24px" font-weight="700" color="#0a0a0a">
          Hello there 👋
        </mj-text>
        <mj-text font-size="16px" color="#3f3f46" line-height="1.6">
          This is your new campaign. Drag blocks from the right panel to build your email.
        </mj-text>
        <mj-button background-color="#18181b" color="#ffffff" href="https://example.com">
          Call to action
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

export function MjmlEditor({ value, onChange }: MjmlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      fromElement: false,
      height: "100%",
      width: "auto",
      storageManager: false,
      plugins: [grapesjsMjml as never],
      pluginsOpts: {
        [grapesjsMjml as unknown as string]: {},
      },
      components: value || DEFAULT_MJML,
    });

    editorRef.current = editor;

    const emit = () => {
      const mjml = editor.getHtml();
      // grapesjs-mjml exposes HTML via the runner
      const runner = editor.runCommand("mjml-get-code") as
        | { html?: string; mjml?: string }
        | undefined;
      const html = runner?.html ?? "";
      onChangeRef.current(mjml, html);
    };

    editor.on("update", emit);
    editor.on("component:update", emit);
    // initial emit so parent has the default
    setTimeout(emit, 200);

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
