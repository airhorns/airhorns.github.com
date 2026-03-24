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

  return (
    <div className="page-container">
      <PageBackground />
      <div className="relative z-10 flex min-h-screen items-start justify-center p-8 pt-24 pb-32">
        <article className="w-full max-w-xl">
          <header className="mb-10">
            <time className="text-xs text-muted-foreground font-mono tracking-wider">
              {meta.date}
            </time>
            <h1 className="text-2xl font-mono tracking-wider text-primary text-glow mt-2">
              {meta.title}
            </h1>
          </header>
          <div className="prose prose-sm max-w-none text-foreground font-body
            prose-headings:font-mono prose-headings:tracking-wider prose-headings:text-foreground
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground
            prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
            prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded
            prose-ol:text-muted-foreground prose-ul:text-muted-foreground
            prose-li:text-muted-foreground
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
