import FlockingCanvas from "@/components/FlockingCanvas";
import Footer from "@/components/Footer";

const Posts = () => {
  return (
    <div className="page-container">
      <FlockingCanvas />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-mono tracking-wider text-primary text-glow mb-6">
            Posts
          </h1>
          <p className="text-muted-foreground text-sm font-body">
            No posts yet.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Posts;
