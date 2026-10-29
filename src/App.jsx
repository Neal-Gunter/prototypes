import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import ExamplePage from "./pages/ExamplePage";
const WorkbenchPage = lazy(() => import("./pages/WorkbenchPage"));
import NotFoundPage from "./pages/NotFoundPage";
import CreditsPage from "./pages/CreditsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/example" element={<ExamplePage />} />
          <Route
            path="/workbench"
            element={
              <Suspense fallback={<p className="p-8 text-ink-soft">正在加载工作台…</p>}>
                <WorkbenchPage />
              </Suspense>
            }
          />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
