import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import About from "./pages/About";
import Posts from "./pages/Posts";
import PostPage from "./pages/PostPage";
import NotFound from "./pages/NotFound";
import Footer from "./components/Footer";

const App = () => (
  <BrowserRouter>
    <Footer />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/about" element={<About />} />
      <Route path="/posts" element={<Posts />} />
      <Route path="/posts/:slug" element={<PostPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
