// Built as a separate ES module and imported on demand, so pages without diagrams never pay for it.
import mermaid from 'mermaid';

let counter = 0;

/** Renders `source` to an SVG string; throws with Mermaid's message on syntax errors. */
export async function renderDiagram(source: string, dark: boolean): Promise<string> {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default' });
  const { svg } = await mermaid.render(`bw-mermaid-${counter++}`, source);
  return svg;
}
