import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import ExamplePage from "./pages/ExamplePage";
const WorkbenchPage = lazy(() => import("./pages/WorkbenchPage"));
const AssemblyPage = lazy(() => import("./pages/AssemblyPage"));
const PartsPage = lazy(() => import("./pages/PartsPage"));
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
          <Route
            path="/assembly"
            element={
              <Suspense fallback={<p className="p-8 text-ink-soft">正在加载装配台…</p>}>
                <AssemblyPage />
              </Suspense>
            }
          />
          <Route
            path="/parts"
            element={
              <Suspense fallback={<p className="p-8 text-ink-soft">正在加载零件库…</p>}>
                <PartsPage />
              </Suspense>
            }
          />
          {/* 旧的“电路实验”页已并入装配台：打开就是同一套电路练习 */}
          <Route path="/electrics" element={<Navigate to="/assembly?scene=electrics" replace />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
