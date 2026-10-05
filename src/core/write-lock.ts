import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

                                                                                   
                                                                                 
                                                                                
                                                         
  
                                                                                
                                                                                
                                                                             
                                                                       

const WAIT_MS = 10_000;

export class LockTimeoutError extends Error {}

export async function withWriteLock<T>(lockFile: string, work: () => Promise<T>, waitMs = WAIT_MS): Promise<T> {
  await fs.mkdir(path.dirname(lockFile), { recursive: true });
  const deadline = Date.now() + waitMs;
  for (let delay = 5; ; delay = Math.min(delay * 2, 200)) {
    try {
      const handle = await fs.open(lockFile, "wx");
      try { await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`); }
      catch (e) { await handle.close(); await fs.rm(lockFile, { force: true }); throw e; }
      await handle.close();
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      if (Date.now() > deadline) throw new LockTimeoutError(`Project write lock is held: ${lockFile}. Retry after the writer finishes. If its process crashed, stop all project writers before removing this abandoned lock.`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  try {
    return await work();
  } finally {
    await fs.rm(lockFile, { force: true });
  }
}

                                                                                 
                                                                      
export async function writeFileAtomic(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, content, { encoding: "utf8", flag: "wx" });
                                                                         
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmp, file);
        return;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code ?? "";
        if (attempt < 20 && ["EPERM", "EBUSY", "EACCES"].includes(code)) {
          await new Promise((r) => setTimeout(r, 25));
          continue;
        }
        throw e;
      }
    }
  } finally {
    await fs.rm(tmp, { force: true });
  }
}
