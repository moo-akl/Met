import { useEffect, useRef, type ClipboardEvent, type ReactNode } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Italic, Link2, List, ListOrdered, Redo2,
  Underline, Undo2, Unlink,
} from "lucide-react";

const allowedTags = new Set([
  "a", "b", "blockquote", "br", "center", "code", "div", "em", "font", "h1", "h2", "h3",
  "hr", "i", "img", "li", "ol", "p", "pre", "s", "span", "strike", "strong", "sub",
  "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
]);
const dangerousTags = new Set(["audio", "button", "embed", "form", "iframe", "input", "link", "math", "meta", "object", "script", "select", "style", "svg", "textarea", "video"]);
const safeStyles = new Set([
  "background", "background-color", "border", "border-bottom", "border-collapse", "border-color", "border-radius",
  "border-spacing", "border-style", "border-top", "border-width", "color", "display",
  "font-family", "font-size", "font-style", "font-weight", "height", "letter-spacing",
  "line-height", "margin", "margin-bottom", "margin-left", "margin-right", "margin-top",
  "max-height", "max-width", "min-height", "min-width", "padding", "padding-bottom",
  "padding-left", "padding-right", "padding-top", "text-align", "text-decoration",
  "text-transform", "vertical-align", "white-space", "width",
]);
const safeAttributes = new Set([
  "alt", "align", "border", "cellpadding", "cellspacing", "colspan", "height", "rowspan",
  "scope", "valign", "width",
]);
const personalizationFields = [
  ["businessName", "Venue name"],
  ["recipientEmail", "Recipient email"],
  ["venueManagerUrl", "Venue Manager link"],
  ["applicationUrl", "Application invitation link"],
] as const;

function allowedUrl(value: string, isImage: boolean): boolean {
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) return true;
  if (!isImage && /^mailto:/i.test(url)) return true;
  if (isImage && /^data:image\/(?:png|gif|jpe?g|webp);base64,/i.test(url)) return true;
  return !isImage && /^\{\{\s*(?:venueManagerUrl|applicationUrl)\s*\}\}(?:[/?#][^\s]*)?$/i.test(url);
}

/** Keep authored email formatting while stripping markup that should never enter the editor or send payload. */
export function sanitizeEmailHtml(source: string): string {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const root = doc.createElement("div");
  root.innerHTML = doc.body.innerHTML;

  const cleanChildren = (parent: Element) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        if (node.nodeType !== Node.TEXT_NODE) node.remove();
        continue;
      }
      const element = node as Element;
      const tag = element.tagName.toLowerCase();
      if (dangerousTags.has(tag)) {
        element.remove();
        continue;
      }
      cleanChildren(element);
      if (!allowedTags.has(tag)) {
        element.replaceWith(...Array.from(element.childNodes));
        continue;
      }
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name === "style") {
          const style = doc.createElement("span").style;
          style.cssText = attribute.value;
          for (const property of Array.from(style)) {
            const value = style.getPropertyValue(property);
            if (!safeStyles.has(property) || /url\s*\(|expression\s*\(|javascript:|@import|position\s*:/i.test(value) ||
              (property === "display" && value.trim().toLowerCase() === "none") ||
              (property === "max-height" && value.trim() === "0px")) {
              style.removeProperty(property);
            }
          }
          if (style.cssText) element.setAttribute("style", style.cssText);
          else element.removeAttribute("style");
        } else if (name === "href" && tag === "a" && allowedUrl(attribute.value, false)) {
          element.setAttribute("href", attribute.value.trim());
        } else if (name === "src" && tag === "img" && allowedUrl(attribute.value, true)) {
          element.setAttribute("src", attribute.value.trim());
        } else if (safeAttributes.has(name) || (tag === "a" && name === "title") || (tag === "img" && name === "title") ||
          (tag === "font" && ["color", "face", "size"].includes(name))) {
          element.setAttribute(name, attribute.value);
        } else {
          element.removeAttribute(attribute.name);
        }
      }
      if (tag === "a" && element.hasAttribute("href")) {
        element.setAttribute("rel", "noopener noreferrer");
      }
    }
  };

  cleanChildren(root);
  return root.innerHTML;
}

export function plainTextEmailToHtml(value: string): string {
  const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
  return value.split(/\r?\n/).map((line) => line ? `<p>${escape(line)}</p>` : "<p><br></p>").join("");
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

export default function RichEmailBodyEditor({ value, onChange, disabled = false }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const current = sanitizeEmailHtml(editor.innerHTML);
    const next = sanitizeEmailHtml(value);
    if (current !== next) editor.innerHTML = next;
  }, [value]);

  const rememberSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return null;
    editor.focus();
    const selection = window.getSelection();
    const saved = savedRangeRef.current;
    if (selection && saved && editor.contains(saved.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(saved);
    }
    return selection;
  };

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(sanitizeEmailHtml(editor.innerHTML));
    rememberSelection();
  };

  const format = (command: string, commandValue?: string) => {
    restoreSelection();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const insertPersonalization = (field: string) => {
    const editor = editorRef.current;
    const selection = restoreSelection();
    if (!editor || !selection) return;
    let range: Range;
    if (selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();
    const token = document.createTextNode(`{{${field}}}`);
    range.insertNode(token);
    range.setStartAfter(token);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
    emitChange();
  };

  const makeLink = () => {
    const address = window.prompt("Enter a website link (https://…) or email link (mailto:…)");
    if (!address) return;
    const cleaned = address.trim();
    if (!/^(https?:\/\/|mailto:)/i.test(cleaned)) {
      window.alert("Use a link starting with https:// or mailto:.");
      return;
    }
    format("createLink", cleaned);
  };

  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const safeContent = html
      ? sanitizeEmailHtml(html)
      : plainTextEmailToHtml(text);
    restoreSelection();
    document.execCommand("insertHTML", false, safeContent);
    emitChange();
  };

  const toolbarButton = (
    label: string,
    icon: ReactNode,
    onClick: () => void,
    active?: boolean,
  ) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 ${active ? "bg-white shadow-sm" : ""}`}
    >
      {icon}
    </button>
  );

  return (
    <div className="mt-1 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2" aria-label="Email formatting tools">
        <select
          aria-label="Text style"
          title="Text style"
          defaultValue="p"
          disabled={disabled}
          onMouseDown={rememberSelection}
          onChange={(event) => {
            format("formatBlock", event.target.value);
            event.currentTarget.value = "p";
          }}
          className="h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
        </select>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {toolbarButton("Bold", <Bold className="h-4 w-4" />, () => format("bold"))}
        {toolbarButton("Italic", <Italic className="h-4 w-4" />, () => format("italic"))}
        {toolbarButton("Underline", <Underline className="h-4 w-4" />, () => format("underline"))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {toolbarButton("Align left", <AlignLeft className="h-4 w-4" />, () => format("justifyLeft"))}
        {toolbarButton("Center", <AlignCenter className="h-4 w-4" />, () => format("justifyCenter"))}
        {toolbarButton("Align right", <AlignRight className="h-4 w-4" />, () => format("justifyRight"))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {toolbarButton("Bulleted list", <List className="h-4 w-4" />, () => format("insertUnorderedList"))}
        {toolbarButton("Numbered list", <ListOrdered className="h-4 w-4" />, () => format("insertOrderedList"))}
        {toolbarButton("Insert link", <Link2 className="h-4 w-4" />, makeLink)}
        {toolbarButton("Remove link", <Unlink className="h-4 w-4" />, () => format("unlink"))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {toolbarButton("Undo", <Undo2 className="h-4 w-4" />, () => format("undo"))}
        {toolbarButton("Redo", <Redo2 className="h-4 w-4" />, () => format("redo"))}
        <select
          aria-label="Insert personalization"
          title="Insert a personalized field"
          defaultValue=""
          disabled={disabled}
          onMouseDown={rememberSelection}
          onChange={(event) => {
            if (event.target.value) insertPersonalization(event.target.value);
            event.currentTarget.value = "";
          }}
          className="ml-auto h-8 max-w-[170px] rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="">Personalization…</option>
          {personalizationFields.map(([field, label]) => (
            <option key={field} value={field}>{label}</option>
          ))}
        </select>
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label="Email body"
        aria-multiline="true"
        data-testid="input-email-template-body"
        data-placeholder="Write your email here…"
        onInput={emitChange}
        onBlur={emitChange}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onFocus={rememberSelection}
        onPaste={paste}
        className="rich-email-template-editor max-h-[420px] min-h-[280px] overflow-auto px-5 py-4 text-sm leading-7 text-slate-800 outline-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-2 text-[11px] text-slate-400">
        <span>Write and format your message like a document.</span>
        <span>Click above to edit · paste to add content</span>
      </div>
    </div>
  );
}
