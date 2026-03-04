import { useParams } from "react-router-dom";
export default function VerifyCard() {
  const { cardId } = useParams();
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <h1 className="text-2xl font-bold">Card Verification</h1>
      <p className="text-slate-400 mt-2">Card: {cardId} — Coming soon</p>
    </div>
  );
}
