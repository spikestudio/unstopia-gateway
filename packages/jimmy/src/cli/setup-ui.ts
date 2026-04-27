import readline from "node:readline";

export const GREEN = "\x1b[32m";
export const YELLOW = "\x1b[33m";
export const RED = "\x1b[31m";
export const DIM = "\x1b[2m";
export const RESET = "\x1b[0m";

export function ok(msg: string): void {
  console.log(`  ${GREEN}[ok]${RESET} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`  ${YELLOW}[warn]${RESET} ${msg}`);
}

export function fail(msg: string): void {
  console.log(`  ${RED}[missing]${RESET} ${msg}`);
}

export function info(msg: string): void {
  console.log(`  ${DIM}${msg}${RESET}`);
}

export function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : "";
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}
