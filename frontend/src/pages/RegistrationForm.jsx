import { useParams } from "react-router-dom";
export default function RegistrationForm() {
  const { projectId } = useParams();
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-bold">Registration Form</h1>
      <p className="text-slate-400 mt-2">Project: {projectId} — Coming soon</p>
    </div>
  );
}
