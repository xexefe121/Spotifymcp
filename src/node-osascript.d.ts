declare module 'node-osascript' {
  export function execute(script: string, callback: (err: Error | null, result: any, raw?: any) => void): void;
  export function executeFile(filePath: string, callback: (err: Error | null, result: any, raw?: any) => void): void;
}
