import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import ExamplePage from "./pages/ExamplePage";
const WorkbenchPage = lazy(() => import("./pages/WorkbenchPage"));
const AssemblyPage = lazy(() => import("./pages/AssemblyPage"));
const PartsPage = lazy(() => import("./pages/PartsPage"));
const GuidePage = lazy(() => import("./pages/GuidePage"));
const OctoGuidePage = lazy(() => import("./pages/OctoGuidePage"));
const ModelLabPage = lazy(() => import("./pages/ModelLabPage"));
const RepairPage = lazy(() => import("./pages/RepairPage"));
const PinoutsPage = lazy(() => import("./pages/PinoutsPage"));
const ProjectPage = lazy(() => import("./pages/ProjectPage"));
import NotFoundPage from "./pages/NotFoundPage";
import CreditsPage from "./pages/CreditsPage";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
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
          <Route
            path="/assembly/guide"
            element={
              <Suspense fallback={<p className="p-8 text-ink-soft">正在加载装配指南…</p>}>
                <GuidePage />
              </Suspense>
            }
          />
          <Route
            path="/assembly/octopus-guide"
            element={
              <Suspense fallback={<p className="p-8 text-ink-soft">正在加载八爪鱼指南…</p>}>
                <OctoGuidePage />
              </Suspense>
            }
          />
          <Route
            path="/assembly/model"
            element={
              <Suspense fallback={<p className="p-8 text-ink-soft">正在加载模型 + 功能图…</p>}>
                <ModelLabPage />
              </Suspense>
            }
          />
          <Route
            path="/repair"
            element={
              <Suspense fallback={<p className="p-8 text-ink-soft">正在加载维修关卡…</p>}>
                <RepairPage />
              </Suspense>
            }
          />
          {/* 旧的“电路实验”页已并入装配台：打开就是同一套电路练习 */}
          <Route path="/project" element={<Suspense fallback={<p className="p-8 text-ink-soft">正在加载引导项目…</p>}><ProjectPage /></Suspense>} />
          <Route path="/project/octopus" element={<Navigate to="/project" replace />} />
          <Route path="/pinouts" element={<Suspense fallback={<p className="p-8 text-ink-soft">正在加载引脚表…</p>}><PinoutsPage /></Suspense>} />
          <Route path="/electrics" element={<Navigate to="/assembly?scene=electrics" replace />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
