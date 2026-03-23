import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import About from "./pages/About";
import Posts from "./pages/Posts";
import NotFound from "./pages/NotFound";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/about" element={<About />} />
      <Route path="/posts" element={<Posts />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
