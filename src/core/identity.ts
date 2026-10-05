                                                                               
                                   
import type { SourceRef } from "./types";

   
                                                                                   
                                                                              
                                                                                
                                                                                  
         
   
export function normalizeLabel(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

   
                                                                               
                                                                           
                                                                                  
                                                                              
                                                                        
   
export function sourceDefinition(ref: SourceRef | undefined): string | null {
  const file = ref?.file?.trim().replace(/\\/g, "/");
  const symbol = ref?.symbol?.trim();
  return file && symbol ? `${file}#${symbol}` : null;
}
