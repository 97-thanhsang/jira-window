import { spawn } from 'child_process';
import path from 'path';
import type { PipelineStage } from '../types/opencode';
import { WIRE_SIGNALS } from '../types/opencode';

const OPENCODE_CLI = process.env.OPENCODE_CLI_PATH || 'opencode';
const PROJECT_DIR  = process.env.OPENCODE_PROJECT_DIR || process.cwd();

export interface RunOptions {
  taskKey: string;
  stage: PipelineStage;
  mode?: 'quick' | 'full' | 'auto';
  autoApprove?: boolean;
  onProgress?: (line: string) => void;
  onDone?: (wireLine: string) => void;
  onError?: (err: string) => void;
}

/**
 * Xây dựng command args cho từng stage
 */
function buildCommand(opts: RunOptions): { cmd: string; args: string[] } {
  const { taskKey, stage, mode, autoApprove } = opts;

  const modeFlag = mode === 'quick' ? '--quick'
                 : mode === 'auto'  ? '--smart-auto'
                 : '';

  const approveFlag = autoApprove ? '--auto-approve' : '';

  const commandMap: Record<PipelineStage, string[]> = {
    decompose: [taskKey, approveFlag].filter(Boolean),
    extractor: [taskKey].filter(Boolean),
    analyze:   [taskKey, modeFlag, '--subagent'].filter(Boolean),
    solution:  [taskKey, modeFlag].filter(Boolean),
    execute:   [taskKey].filter(Boolean),
  };

  return {
    cmd: OPENCODE_CLI,
    args: ['run', `/${stage}-task`, ...commandMap[stage]],
  };
}

/**
 * Chạy OpenCode CLI cho một stage
 * Returns: Promise<wireLine string>
 */
export function runPipelineStage(opts: RunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const { cmd, args } = buildCommand(opts);
    const wireSignal = WIRE_SIGNALS[opts.stage];

    const proc = spawn(cmd, args, {
      cwd: PROJECT_DIR,
      env: {
        ...process.env,
        OPENCODE_DEFAULT_PROJECT_DIR: PROJECT_DIR,
      },
    });

    let wireLine = '';
    // Buffer incomplete line fragments across consecutive data chunks
    let stdoutBuffer = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();

      // Process only complete lines; leave the trailing fragment in the buffer
      const newlineIdx = stdoutBuffer.lastIndexOf('\n');
      if (newlineIdx === -1) return; // no complete line yet

      const completeChunk = stdoutBuffer.slice(0, newlineIdx + 1);
      stdoutBuffer = stdoutBuffer.slice(newlineIdx + 1);

      for (const line of completeChunk.split('\n')) {
        if (line) opts.onProgress?.(line);

        if (line.includes(wireSignal)) {
          wireLine = line.trim();
          opts.onDone?.(wireLine);
        }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      opts.onError?.(chunk.toString());
    });

    proc.on('close', (code) => {
      // Flush any remaining buffered output (line without trailing newline)
      if (stdoutBuffer.trim()) {
        opts.onProgress?.(stdoutBuffer.trim());
        if (stdoutBuffer.includes(wireSignal)) {
          wireLine = stdoutBuffer.trim();
          opts.onDone?.(wireLine);
        }
      }

      if (wireLine && code === 0) {
        // Clean success: wire signal found and process exited cleanly
        resolve(wireLine);
      } else if (wireLine && code !== 0) {
        // Wire signal found but process exited non-zero — treat as failure
        // (signal may have been emitted in a warning before a fatal error)
        reject(new Error(`OpenCode exited with code ${code} after emitting wire signal`));
      } else if (code !== 0) {
        reject(new Error(`OpenCode exited with code ${code}`));
      } else {
        reject(new Error(`Wire signal "${wireSignal}" not found in output`));
      }
    });

    proc.on('error', reject);
  });
}
