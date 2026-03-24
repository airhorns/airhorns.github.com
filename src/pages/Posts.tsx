import { Link } from "react-router-dom";
import PageBackground from "@/components/PageBackground";
import { getAllPosts } from "@/lib/posts";

const Posts = () => {
  const posts = getAllPosts();

  return (
    <div className="page-container">
      <PageBackground />
      <div className="relative z-10 flex min-h-screen items-start justify-center p-8 pt-24">
        <div className="w-full max-w-xl">
          <h1 className="text-2xl font-mono tracking-wider text-primary text-glow mb-12">
            Posts
          </h1>
          <ul className="space-y-8">
            {posts.map((post) => (
              <li key={post.meta.slug}>
                <Link
                  to={`/posts/${post.meta.slug}`}
                  className="group block"
                >
                  <time className="text-xs text-muted-foreground font-mono tracking-wider">
                    {post.meta.date}
                  </time>
                  <h2 className="text-lg font-mono tracking-wide text-foreground group-hover:text-primary transition-colors duration-200 mt-1">
                    {post.meta.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 font-body leading-relaxed">
                    {post.meta.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Posts;
