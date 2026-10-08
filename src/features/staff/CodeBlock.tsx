import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

/** Lazy-loaded by AiChat so the ~600 KB highlighter isn't in the chat's main chunk. */
export default function CodeBlock({ code, language, isDark }: { code: string; language: string; isDark: boolean }) {
  return (
    <SyntaxHighlighter style={isDark ? oneDark : oneLight} language={language} PreTag="div" wrapLongLines
      customStyle={{ margin: 0, borderRadius: '0 0 6px 6px', fontSize: '0.74rem' }}>
      {code}
    </SyntaxHighlighter>
  );
}
