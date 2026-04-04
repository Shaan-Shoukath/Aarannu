export default function ColumnMappingPanel({
  sheetHeaders,
  sheetRows,
  columnMap,
  setColumnMap,
  MAPPABLE_FIELDS,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-700">
          Map Columns ({sheetRows.length} rows found)
        </h3>
        <button
          onClick={onCancel}
          className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
        >
          ✕ Cancel
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {MAPPABLE_FIELDS.map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <div className="w-1/3 min-w-[100px]">
              <label className="text-xs font-medium text-slate-700 block truncate">
                {f.label}{" "}
                {f.required && <span className="text-red-500">*</span>}
              </label>
            </div>
            <select
              value={columnMap[f.key] ?? -1}
              onChange={(e) =>
                setColumnMap((prev) => ({
                  ...prev,
                  [f.key]: Number(e.target.value),
                }))
              }
              className="flex-1 rounded-md border border-slate-300 bg-white text-xs py-1.5 px-2 text-slate-700 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            >
              <option value={-1}>-- Ignore --</option>
              {sheetHeaders.map((header, idx) => (
                <option key={idx} value={idx}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button
        onClick={onConfirm}
        className="w-full mt-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-bold shadow-sm transition-colors"
      >
        Confirm Mapping & Import
      </button>
      <p className="text-[10px] text-slate-500 text-center leading-tight">
        Unmapped columns will be automatically added as custom fields.
      </p>
    </div>
  );
}
