                                                                                    
                                                                       

export const SEQ = {
  laneGap: 210,                                                                       
  left: 150,                                  
  top: 14,                                                                              
  rowH: 56,                                              
  sepH: 34,                          
  botPad: 40,
  ahead: 9,                  
  selfW: 34,                        
  depthInset: 6,                                             
  headerH: 40,                                                                       
  railW: 30,                           
  actorBoxW: 210,                                                           
  actorBoxMinW: 60,                                                                   
  actorBoxGap: 16,                                                         
  actorBoxH: 26,
  actorAccentH: 3,                                                      
                                                                              
                                                                                 
                                                 
  minLaneGap: 80,
  maxLaneGap: 560,
  minRowH: 34,
  maxRowH: 120,
} as const;

                                                                                
export interface SeqDims {
  laneGap: number;
  rowH: number;
}

export const laneX = (i: number, laneGap: number = SEQ.laneGap): number => SEQ.left + i * laneGap;

                                                              
export const seqWidth = (n: number, laneGap: number): number => SEQ.left * 2 + Math.max(0, n - 1) * laneGap;

                                                                                    
export function arrowHead(x: number, y: number, dir: 1 | -1): string {
  const a = SEQ.ahead;
  return `${x},${y} ${x - dir * a},${y - a * 0.7} ${x - dir * a},${y + a * 0.7}`;
}
