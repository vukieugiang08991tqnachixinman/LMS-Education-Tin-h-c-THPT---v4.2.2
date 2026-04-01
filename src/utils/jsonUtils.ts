export const parseTruncatedJSON = (jsonString: string) => {
  if (!jsonString) return [];
  
  let cleanString = jsonString.trim();
  
  // Try to extract JSON from markdown code blocks
  const jsonMatch = cleanString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    cleanString = jsonMatch[1].trim();
  } else {
    // If no code block, maybe there's text before/after the JSON array/object
    const firstBracket = cleanString.indexOf('[');
    const firstBrace = cleanString.indexOf('{');
    const lastBracket = cleanString.lastIndexOf(']');
    const lastBrace = cleanString.lastIndexOf('}');
    
    let startIdx = -1;
    let endIdx = -1;
    
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIdx = firstBracket;
      endIdx = lastBracket;
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
      endIdx = lastBrace;
    }
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
      cleanString = cleanString.substring(startIdx, endIdx + 1);
    }
  }
  
  let parsed: any = null;
  try {
    parsed = JSON.parse(cleanString);
  } catch (e: any) {
    if (e.message.includes('Unterminated string') || e.message.includes('Unexpected end of JSON input') || e.message.includes('Expected')) {
      let fixedString = cleanString;
      let success = false;
      while (fixedString.length > 0) {
        const lastBrace = fixedString.lastIndexOf('}');
        const lastBracket = fixedString.lastIndexOf(']');
        const lastChar = Math.max(lastBrace, lastBracket);
        
        if (lastChar === -1) break;
        
        const isArray = cleanString.trim().startsWith('[');
        fixedString = fixedString.substring(0, lastChar + 1) + (isArray && lastChar === lastBrace ? ']' : '');
        
        try {
          parsed = JSON.parse(fixedString);
          success = true;
          break;
        } catch (err) {
          fixedString = fixedString.substring(0, lastChar);
        }
      }
      if (!success) throw e;
    } else {
      throw e;
    }
  }

  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed.data)) return parsed.data;
    if (Array.isArray(parsed.items)) return parsed.items;
    return [parsed];
  }
  return [];
};
