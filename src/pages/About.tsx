import PageBackground from "@/components/PageBackground";

const About = () => {
  return (
    <div className="page-container">
      <PageBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-mono tracking-wider text-primary text-glow mb-6">
            About
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed font-body">
            Coming soon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
