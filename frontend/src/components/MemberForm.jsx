export default function MemberForm({
  form,
  onChange,
  onAdd,
  customFieldDefs,
}) {
  return (
    <div className="space-y-3 pt-6 border-t border-slate-100">
      <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-2">
        Add Member Manually
      </h2>
      <div className="space-y-4">
        {/* Basic Fields */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 outline-none px-3"
            placeholder="e.g. John Doe"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 outline-none px-3"
              placeholder="e.g. john@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">
              Role
            </label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => onChange("role", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 outline-none px-3"
              placeholder="e.g. Member"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">
              ID Number
            </label>
            <input
              type="text"
              value={form.id_number}
              onChange={(e) => onChange("id_number", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 outline-none px-3"
              placeholder="Auto-generated"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">
              Date of Birth
            </label>
            <input
              type="date"
              value={form.dob}
              onChange={(e) => onChange("dob", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 outline-none px-3 text-slate-600"
            />
          </div>
        </div>

        {/* Custom Fields */}
        {customFieldDefs.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase">
              Custom Fields
            </h3>
            {customFieldDefs.map((def, idx) => (
              <div key={idx} className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">
                  {def.label}
                </label>
                <input
                  type={def.type === "date" ? "date" : "text"}
                  value={form.customValues[def.label] || ""}
                  onChange={(e) =>
                    onChange("customValues", {
                      ...form.customValues,
                      [def.label]: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white text-sm focus:border-[#2563EB] focus:ring-[#2563EB] py-2 outline-none px-3"
                  placeholder={`Enter ${def.label}...`}
                />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onAdd}
          disabled={!form.name.trim()}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold shadow-md transition-all disabled:opacity-50"
        >
          Add to Queue
        </button>
      </div>
    </div>
  );
}
