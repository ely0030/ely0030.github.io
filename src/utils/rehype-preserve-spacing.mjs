import { visit } from 'unist-util-visit';

export function rehypePreserveSpacing() {
  return (tree, file) => {
    // Only apply to literature pages
    const frontmatter = file.data.astro?.frontmatter;
    if (frontmatter?.pageType !== 'literature') {
      return;
    }

    // Process HTML tree to add empty paragraphs
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index === null) return;
      
      // Look for consecutive p elements
      if (node.tagName === 'p' && index < parent.children.length - 1) {
        // Check next sibling
        let nextIndex = index + 1;
        
        // Skip text nodes that are just whitespace
        while (nextIndex < parent.children.length && 
               parent.children[nextIndex].type === 'text' && 
               parent.children[nextIndex].value.trim() === '') {
          nextIndex++;
        }
        
        if (nextIndex < parent.children.length && 
            parent.children[nextIndex].type === 'element' &&
            parent.children[nextIndex].tagName === 'p') {
          
          // Check if current paragraph ends with a br
          const endsWithBr = node.children && 
            node.children.length > 0 && 
            node.children[node.children.length - 1].tagName === 'br';
          
          // Only add spacing if paragraph doesn't end with br
          if (!endsWithBr) {
            // Insert empty paragraph after current one
            const emptyP = {
              type: 'element',
              tagName: 'p',
              properties: {},
              children: [{
                type: 'text',
                value: '\u00A0'
              }]
            };
            
            // Insert the empty paragraph
            parent.children.splice(index + 1, 0, emptyP);
          }
        }
      }
    });
  };
}