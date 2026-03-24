import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const Footer = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const prevIsHome = useRef(isHome);
  const [animClass, setAnimClass] = useState("");
  const [position, setPosition] = useState<"top" | "bottom">(isHome ? "bottom" : "top");

  useEffect(() => {
    if (prevIsHome.current !== isHome) {
      // Start exit: slide down off screen
      setAnimClass("nav-header-exit");

      const exitTimer = setTimeout(() => {
        // Snap to new position (off-screen at top)
        setPosition(isHome ? "bottom" : "top");
        setAnimClass("nav-header-enter");

        const enterTimer = setTimeout(() => {
          setAnimClass("");
        }, 500);

        return () => clearTimeout(enterTimer);
      }, 400);

      prevIsHome.current = isHome;
      return () => clearTimeout(exitTimer);
    } else {
      setPosition(isHome ? "bottom" : "top");
    }
  }, [isHome]);

  const linkClass = (path: string) =>
    `nav-link ${location.pathname === path ? "nav-link-active" : ""}`;

  const positionClass = position === "bottom"
    ? "bottom-0 items-end"
    : "top-0 items-start";

  return (
    <div
      className={`fixed left-0 right-0 z-50 p-8 flex justify-between pointer-events-none ${positionClass} ${animClass}`}
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
