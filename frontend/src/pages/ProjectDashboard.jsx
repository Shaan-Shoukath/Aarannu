import { useParams } from "react-router-dom";
export default function ProjectDashboard() {
  const { slug, projectId } = useParams();
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-bold">Project: {projectId}</h1>
      <p className="text-slate-400 mt-2">Coming soon — Sprint 3</p>
    </div>
  );
}
