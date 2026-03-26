import PageBackground from "@/components/PageBackground";
import AboutContent from "@/content/about.mdx";

const About = () => {
  return (
    <div className="page-container">
      <PageBackground />
      <div className="relative z-10 flex min-h-screen items-start justify-center p-8 pt-24 pb-32">
        <article className="w-full max-w-2xl">
          <header className="mb-10">
            <h1 className="text-2xl font-mono tracking-wider text-primary text-glow">
              About
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
            <AboutContent />
          </div>
        </article>
      </div>
    </div>
  );
};

export default About;
