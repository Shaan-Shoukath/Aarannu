import { useParams } from "react-router-dom";
export default function ProjectCreate() {
  const { slug } = useParams();
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-bold">Create Project — {slug}</h1>
      <p className="text-slate-400 mt-2">Coming soon — Sprint 2</p>
    </div>
  );
}
