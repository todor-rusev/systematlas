                                                                         
  
                                   
                                     
                                                                              
                   
                                                                                
                            
                                                                                
                                                                            

const KEY = "systematlas";                                                         
const DISPLAY = "SystemAtlas";                                          
const ALIASES = ["sysatlas"];                                

const UPPER = KEY.toUpperCase().replace(/[^A-Z0-9]/g, "_");

export const BRAND = {
                                                    
  key: KEY,
                          
  display: DISPLAY,
                            
  cli: KEY,
                                          
  cliAliases: ALIASES,
                                                                                
  mcpName: KEY,
                                                         
  mcpPackage: `${KEY}-mcp`,
                                                   
  uriScheme: KEY,
                                                 
  storeDir: `.${KEY}`,
                                                                                  
  legacyStoreDirs: [".flowtrace"] as string[],
                                                            
  envScope: `${UPPER}_SCOPE`,
                                                 
  envWorkspace: `${UPPER}_WORKSPACE`,
                                                                  
  globalVar: `__${UPPER}__`,
} as const;

                                                                                       
export const STORE_DIRS: string[] = [BRAND.storeDir, ...BRAND.legacyStoreDirs];
