import { Button, Field, Input } from "./ui";

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
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Basic Fields */}
        <Field label="Full Name *">
          <Input
            type="text"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="e.g. John Doe"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="e.g. john@example.com"
            />
          </Field>
          <Field label="Role">
            <Input
              type="text"
              value={form.role}
              onChange={(e) => onChange("role", e.target.value)}
              placeholder="e.g. Member"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ID Number">
            <Input
              type="text"
              value={form.id_number}
              onChange={(e) => onChange("id_number", e.target.value)}
              placeholder="Auto-generated"
            />
          </Field>
          <Field label="Date of Birth">
            <Input
              type="date"
              value={form.dob}
              onChange={(e) => onChange("dob", e.target.value)}
              className="text-slate-600"
            />
          </Field>
        </div>

        {/* Custom Fields */}
        {customFieldDefs.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase">
              Custom Fields
            </h3>
            {customFieldDefs.map((def, idx) => (
              <Field key={idx} label={def.label}>
                <Input
                  type={def.type === "date" ? "date" : "text"}
                  value={form.customValues[def.label] || ""}
                  onChange={(e) =>
                    onChange("customValues", {
                      ...form.customValues,
                      [def.label]: e.target.value,
                    })
                  }
                  placeholder={`Enter ${def.label}...`}
                />
              </Field>
            ))}
          </div>
        )}

        <Button
          onClick={onAdd}
          disabled={!form.name.trim()}
          variant="dark"
          className="w-full"
        >
          Add to Queue
        </Button>
      </div>
    </div>
  );
}
