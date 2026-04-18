import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface FileUploadZoneProps {
  onFile: (buffer: ArrayBuffer, file: File) => void;
  title?: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
}

export function FileUploadZone({
  onFile,
  title = "Déposer votre fichier Excel",
  description,
  loading = false,
  error = null,
}: FileUploadZoneProps) {
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => onFile(e.target!.result as ArrayBuffer, file);
      reader.readAsArrayBuffer(file);
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <motion.label
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex flex-col items-center justify-center gap-5 p-14 rounded-2xl border-2 border-dashed cursor-pointer
        select-none transition-all duration-200
        ${dragging ? "border-gold bg-gold/5 scale-[1.005]" : ""}
        ${error ? "border-destructive/40 bg-destructive/5" : ""}
        ${!dragging && !error ? "border-border bg-card hover:border-gold/50 hover:bg-gold/3" : ""}
      `}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept=".xlsx,.xls"
        className="sr-only"
        onChange={handleChange}
        disabled={loading}
      />

      {/* Icon */}
      <div
        className={`h-20 w-20 rounded-2xl flex items-center justify-center shadow-elegant transition-all duration-300
          ${dragging ? "scale-110" : ""}
          ${error ? "bg-destructive/10" : ""}
          ${!error ? "" : ""}
        `}
        style={!error ? { background: "var(--gradient-hero)" } : undefined}
      >
        {loading ? (
          <Loader2 className="h-9 w-9 text-gold animate-spin" />
        ) : error ? (
          <AlertCircle className="h-9 w-9 text-destructive" />
        ) : (
          <FileSpreadsheet className="h-9 w-9 text-gold" />
        )}
      </div>

      {/* Text */}
      <div className="text-center">
        <div className="font-semibold text-foreground text-[1.05rem]">
          {loading ? "Analyse en cours…" : error ? "Erreur de lecture" : title}
        </div>
        <div className="text-sm text-muted-foreground mt-1.5 max-w-xs">
          {loading
            ? "Extraction et traitement des données Excel"
            : error
            ? error
            : (description ?? "Glissez-déposez votre fichier ou cliquez pour parcourir · .xlsx, .xls")}
        </div>
      </div>

      {/* Decorative label */}
      {!loading && !error && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/6 border border-primary/10">
          <Upload className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-xs font-medium text-primary/70">Sélectionner un fichier</span>
        </div>
      )}
    </motion.label>
  );
}

export function FileInfoBar({
  file,
  rowCount,
  sheetName,
  onReset,
}: {
  file: File;
  rowCount: number;
  sheetName?: string;
  onReset: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 bg-card border border-emerald-200/60 rounded-xl px-5 py-3.5 shadow-sm"
    >
      <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
        <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground text-sm truncate">{file.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {rowCount.toLocaleString("fr-FR")} lignes
          {sheetName ? ` · Feuille : ${sheetName}` : ""}
          {" · "}
          {(file.size / 1024).toFixed(0)} Ko
        </div>
      </div>
      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
      <button
        onClick={onReset}
        className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive
          transition-colors border border-border hover:border-destructive/30 rounded-lg px-3 py-1.5"
      >
        <X className="h-3.5 w-3.5" /> Changer le fichier
      </button>
    </motion.div>
  );
}
