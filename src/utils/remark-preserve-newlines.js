/**
 * Remark plugin to preserve multiple consecutive newlines
 * Adds break nodes to paragraph children to create exact spacing
 */

export default function remarkPreserveNewlines() {
  return (tree, file) => {
    // Only log for our test file
    const isTestFile = file.path && file.path.includes('newline-test');
    
    // Process backwards to avoid index issues
    for (let i = tree.children.length - 1; i > 0; i--) {
      const node = tree.children[i];
      const prevNode = tree.children[i - 1];
      
      // Check if both are paragraphs with position info
      if (node.type === 'paragraph' && prevNode.type === 'paragraph' && 
          node.position && prevNode.position) {
        
        // Get the source text between paragraphs
        const source = file.value || file.toString();
        const gapStart = prevNode.position.end.offset;
        const gapEnd = node.position.start.offset;
        const gapText = source.slice(gapStart, gapEnd);
        
        // Count newlines in the gap
        const newlineCount = (gapText.match(/\n/g) || []).length;
        
        if (isTestFile) {
          const prevText = source.slice(prevNode.position.start.offset, prevNode.position.end.offset);
          const currText = source.slice(node.position.start.offset, node.position.end.offset);
          console.log(`\nGap between "${prevText}" and "${currText}": ${newlineCount} newlines`);
        }
        
        // For 2+ newlines, add break nodes to the end of the previous paragraph
        if (newlineCount >= 2) {
          // Ensure the paragraph has a children array
          if (!prevNode.children) prevNode.children = [];
          
          // Add break nodes for each newline
          for (let j = 0; j < newlineCount; j++) {
            prevNode.children.push({
              type: 'break'
            });
          }
          
          if (isTestFile) {
            console.log(`Added ${newlineCount} break nodes to paragraph`);
          }
        }
      }
    }
  };
}