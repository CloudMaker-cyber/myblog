import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 注意：没有启用 rehype-raw。
 * react-markdown 默认不解析原始 HTML，所以文章里写 <script> 只会被当成文本显示。
 * 一旦加上 rehype-raw，作者就能往页面里注入任意 HTML —— XSS 大门就此打开。
 */
export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        ),
        /**
         * 图片统一不带 Referer：
         * 很多图床有防盗链，看到陌生来源直接拒；不带 Referer 反而能正常取图。
         */
        img: ({ src, alt }) => (
          <img src={src} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
