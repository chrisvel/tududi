import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import hljs from 'highlight.js';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  useEffect(() => {
    // Configure highlight.js
    hljs.configure({
      languages: ['javascript', 'typescript', 'python', 'java', 'css', 'html', 'json', 'bash', 'sql', 'yaml', 'xml', 'dockerfile', 'nginx', 'apache']
    });
    
    // Manual highlighting for any missed code blocks
    const timer = setTimeout(() => {
      const codeBlocks = document.querySelectorAll('pre code:not(.hljs)');
      codeBlocks.forEach((block) => {
        hljs.highlightElement(block as HTMLElement);
      });
    }, 100);
    
    return () => clearTimeout(timer);
  }, [content]);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          // Customize heading styles
          h1: ({...props}) => <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100" {...props} />,
          h2: ({...props}) => <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-gray-100" {...props} />,
          h3: ({...props}) => <h3 className="text-xl font-medium mb-2 text-gray-900 dark:text-gray-100" {...props} />,
          h4: ({...props}) => <h4 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100" {...props} />,
          h5: ({...props}) => <h5 className="text-base font-medium mb-2 text-gray-900 dark:text-gray-100" {...props} />,
          h6: ({...props}) => <h6 className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100" {...props} />,
          
          // Customize paragraph styles
          p: ({...props}) => <p className="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed" {...props} />,
          
          // Customize list styles
          ul: ({...props}) => <ul className="mb-3 list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300" {...props} />,
          ol: ({...props}) => <ol className="mb-3 list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300" {...props} />,
          li: ({...props}) => <li className="ml-4" {...props} />,
          
          // Customize link styles
          a: ({...props}) => <a className="text-blue-600 dark:text-blue-400 hover:underline" {...props} />,
          
          // Customize code styles
          code: ({className, children, ...props}) => {
            // Check if this is a code block (has language class) or inline code
            const isCodeBlock = className && className.startsWith('language-');
            
            if (isCodeBlock) {
              // This is a code block - add hljs class to ensure our styles apply
              return <code className={`${className} hljs`} {...props}>{children}</code>;
            } else {
              // This is inline code - apply our custom styling
              // Check if parent is a pre element - if so, this might be a code block without language
              const parentIsPre = (props as any).node?.parent?.tagName === 'pre';
              if (parentIsPre) {
                return <code className="hljs" {...props}>{children}</code>;
              }
              return <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-900 dark:text-gray-100" {...props}>{children}</code>;
            }
          },
          pre: ({...props}) => <pre className="mb-4 rounded-lg overflow-x-auto" {...props} />,
          
          // Customize blockquote styles
          blockquote: ({...props}) => <blockquote className="mb-4 pl-4 border-l-4 border-gray-300 dark:border-gray-600 italic text-gray-600 dark:text-gray-400" {...props} />,
          
          // Customize table styles
          table: ({...props}) => <table className="mb-4 w-full border-collapse border border-gray-300 dark:border-gray-600" {...props} />,
          thead: ({...props}) => <thead className="bg-gray-100 dark:bg-gray-800" {...props} />,
          th: ({...props}) => <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100" {...props} />,
          td: ({...props}) => <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-700 dark:text-gray-300" {...props} />,
          
          // Customize horizontal rule
          hr: ({...props}) => <hr className="my-6 border-gray-300 dark:border-gray-600" {...props} />,
          
          // Customize strong/bold text
          strong: ({...props}) => <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />,
          
          // Customize italic text
          em: ({...props}) => <em className="italic text-gray-700 dark:text-gray-300" {...props} />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;