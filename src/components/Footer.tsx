import { Link, useLocation } from "react-router-dom";

const Footer = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";

  const linkClass = (path: string) =>
    `nav-link ${location.pathname === path ? "nav-link-active" : ""}`;

  return (
    <div
      className={`fixed left-0 right-0 z-10 p-8 flex justify-between pointer-events-none transition-all duration-500 ease-in-out ${
        isHome ? "top-[100vh] -translate-y-full items-end" : "top-0 translate-y-0 items-start"
      }`}
    >
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
    </div>
  );
};

export default Footer;
