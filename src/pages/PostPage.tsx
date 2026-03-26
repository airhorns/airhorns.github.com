import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import PageBackground from "@/components/PageBackground";
import { getPostBySlug } from "@/lib/posts";

const PostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) {
    return (
      <div className="page-container">
        <PageBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center p-8">
          <div className="text-center">
            <h1 className="text-2xl font-mono tracking-wider text-primary text-glow mb-4">
              Post not found
            </h1>
            <Link to="/posts" className="nav-link">
              ← Back to posts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { Component, meta } = post;

  useEffect(() => {
    document.title = `${meta.title} - harry.me`;
    return () => { document.title = "harry.me"; };
  }, [meta.title]);

  return (
    <div className="page-container">
      <PageBackground />
      <div className="relative z-10 flex min-h-screen items-start justify-center p-8 pt-24 pb-32">
        <article className="w-full max-w-2xl">
          <header className="mb-10">
            <time className="text-xs text-muted-foreground font-mono tracking-wider">
              {meta.date}
            </time>
            <h1 className="text-2xl font-mono tracking-wider text-primary text-glow mt-2">
              {meta.title}
            </h1>
          </header>
          <div className="prose prose-base max-w-none font-prose
            prose-headings:font-mono prose-headings:tracking-wider prose-headings:text-foreground
            prose-p:text-foreground/90 prose-p:leading-[1.8]
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground
            prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-body
            prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded prose-pre:font-body prose-pre:text-sm
            prose-ol:text-foreground/90 prose-ul:text-foreground/90
            prose-li:text-foreground/90 prose-li:leading-[1.8]
            prose-blockquote:text-foreground/60 prose-blockquote:border-primary/30
          ">
            <Component />
          </div>
          <div className="mt-16">
            <Link to="/posts" className="nav-link text-xs">
              ← Back to posts
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
};

export default PostPage;
