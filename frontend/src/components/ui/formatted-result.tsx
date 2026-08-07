interface FormattedResultProps {
  result: string;
  parameters?: any;
}

export function FormattedResult({ result, parameters }: FormattedResultProps) {
  if (!result) return null;

  // Extract parameter names
  const paramNames = new Set<string>();
  if (parameters && parameters.properties) {
    Object.keys(parameters.properties).forEach(key => {
      paramNames.add(key.trim());
    });
  }

  // Split text by {{...}}
  const parts = result.split(/(\{\{[^{}]*\}\})/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("{{") && part.endsWith("}}")) {
          const varName = part.slice(2, -2).trim();
          if (paramNames.has(varName)) {
            return (
              <span
                key={index}
                className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 rounded px-1 py-0.5 mx-0.5 font-mono text-[11px] font-medium inline-block align-middle"
              >
                {part}
              </span>
            );
          }
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}
