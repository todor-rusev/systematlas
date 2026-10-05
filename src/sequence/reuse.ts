                                                                                
                                                                                     
import type { SequenceCall } from "../core/sequence-types";
import { sourceDefinition } from "../core/identity";

   
                                                                                  
                                                                        
                                                                             
                                                                                  
                                                                                 
                                                                                 
                                                                                   
                 
  
                                                                                    
                            
   
export function reuseGroups(calls: SequenceCall[]): Map<string, string[]> {
  const byMethod = new Map<string, SequenceCall[]>();
  for (const c of calls) {
    const key = `${c.to}\u0000${c.method.trim()}`;
    byMethod.set(key, [...(byMethod.get(key) ?? []), c]);
  }

  const groups = new Map<string, string[]>();
  const assign = (members: SequenceCall[]) => {
    const ids = members.map((c) => c.id);
    for (const id of ids) groups.set(id, ids);
  };
  for (const same of byMethod.values()) {
    const definitions = new Set(same.map((c) => sourceDefinition(c.source)).filter(Boolean));
    if (definitions.size <= 1) {
      assign(same);
      continue;
    }
    const byDefinition = new Map<string, SequenceCall[]>();
    for (const c of same) {
      const d = sourceDefinition(c.source);
      if (d) byDefinition.set(d, [...(byDefinition.get(d) ?? []), c]);
      else assign([c]);
    }
    byDefinition.forEach(assign);
  }
  return groups;
}
