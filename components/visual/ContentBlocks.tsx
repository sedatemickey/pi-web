import type { VisualContentBlock } from "@/lib/visual/schema";

export function ContentBlocks({ blocks }: { blocks: readonly VisualContentBlock[] }) {
  return (
    <div className="visual-content-blocks">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "text":
            return <p className="visual-content-text" key={index}>{block.text}</p>;
          case "list": {
            const List = block.style === "numbered" ? "ol" : "ul";
            return (
              <List className="visual-content-list" key={index}>
                {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
              </List>
            );
          }
          case "key-value":
            return (
              <dl className="visual-content-key-values" key={index}>
                {block.items.map((item, itemIndex) => (
                  <div key={`${item.label}-${itemIndex}`}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            );
          case "code":
            return (
              <pre className="visual-content-code" data-language={block.language} key={index}>
                <code>{block.code}</code>
              </pre>
            );
          case "table":
            return (
              <div className="visual-content-table-wrap" key={index}>
                <table className="visual-content-table">
                  <thead>
                    <tr>{block.columns.map((column, columnIndex) => <th scope="col" key={columnIndex}>{column}</th>)}</tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
