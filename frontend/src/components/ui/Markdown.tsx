import ReactMarkdown, { type Components } from 'react-markdown';

/**
 * Markdown con los estilos del theme UCN.
 *
 * SANITIZACIÓN: react-markdown NO renderiza HTML crudo salvo que se añada el plugin
 * `rehype-raw`, que deliberadamente NO se instala. Todo lo que escriba el admin se
 * escapa: `<script>` y demás aparecen como texto, no como nodos del DOM.
 */
const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 break-words text-lg font-bold text-text-primary first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 break-words text-base font-bold text-text-primary first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 break-words text-sm font-bold text-text-primary first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mt-2 break-words leading-relaxed text-text-primary first:mt-0">{children}</p>
  ),
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="break-words text-text-primary">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-4 border-border pl-3 text-text-secondary">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-text-primary">
      {children}
    </code>
  ),
  hr: () => <hr className="my-4 border-border" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`min-w-0 text-sm ${className}`}>
      <ReactMarkdown components={COMPONENTS}>{children}</ReactMarkdown>
    </div>
  );
}
