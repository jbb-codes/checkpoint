export function createLineReader(
  onLine: (line: string) => void,
): (chunk: Buffer | string) => void {
  let buffer = "";

  return (chunk) => {
    buffer += chunk.toString();
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) onLine(line);
    }
  };
}
