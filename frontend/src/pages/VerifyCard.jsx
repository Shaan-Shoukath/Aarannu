import { useParams } from "react-router-dom";
export default function VerifyCard() {
  const { cardId } = useParams();
  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900 p-8 font-['Inter',sans-serif]">
      <h1 className="text-2xl font-bold">Card Verification</h1>
      <p className="text-slate-500 mt-2">Card: {cardId} — Coming soon</p>
    </div>
  );
}
