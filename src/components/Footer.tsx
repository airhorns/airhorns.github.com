import { Link, useLocation } from "react-router-dom";

const Footer = () => {
  const location = useLocation();

  const linkClass = (path: string) =>
    `nav-link ${location.pathname === path ? "nav-link-active" : ""}`;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-10 p-8 flex justify-between items-end pointer-events-none">
      <div className="pointer-events-auto">
        <Link to="/" className="text-glow font-mono text-lg tracking-wider text-primary">
          airhorns
        </Link>
      </div>
      <nav className="pointer-events-auto flex gap-8">
        <Link to="/about" className={linkClass("/about")}>
          About
        </Link>
        <Link to="/posts" className={linkClass("/posts")}>
          Posts
        </Link>
      </nav>
    </footer>
  );
};

export default Footer;
