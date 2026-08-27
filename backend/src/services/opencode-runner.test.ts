import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawn = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => ({ spawn }));

import { runPipelineStage } from './opencode-runner';

/** Minimal ChildProcess stand-in with controllable stdout/stderr streams. */
class FakeProc extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  emitStdout(text: string): void {
    this.stdout.emit('data', Buffer.from(text));
  }

  emitStderr(text: string): void {
    this.stderr.emit('data', Buffer.from(text));
  }

  close(code: number | null): void {
    this.emit('close', code);
  }
}

let proc: FakeProc;

beforeEach(() => {
  proc = new FakeProc();
  spawn.mockReset();
  spawn.mockImplementation(() => proc);
});

describe('runPipelineStage command construction', () => {
  it('runs the slash command for the stage with the task key', async () => {
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'execute' });
    proc.emitStdout('[EXECUTE_DONE] ok\n');
    proc.close(0);
    await promise;

    const [cmd, args, options] = spawn.mock.calls[0];
    expect(cmd).toBe('opencode');
    expect(args).toEqual(['run', '/execute-task', 'ABC-1']);
    expect(options.env.OPENCODE_DEFAULT_PROJECT_DIR).toBe(options.cwd);
  });

  it.each([
    [{ stage: 'analyze' as const }, ['run', '/analyze-task', 'ABC-1', '--subagent']],
    [{ stage: 'analyze' as const, mode: 'quick' as const }, ['run', '/analyze-task', 'ABC-1', '--quick', '--subagent']],
    [{ stage: 'analyze' as const, mode: 'auto' as const }, ['run', '/analyze-task', 'ABC-1', '--smart-auto', '--subagent']],
    [{ stage: 'analyze' as const, mode: 'full' as const }, ['run', '/analyze-task', 'ABC-1', '--subagent']],
    [{ stage: 'solution' as const, mode: 'quick' as const }, ['run', '/solution-task', 'ABC-1', '--quick']],
    [{ stage: 'decompose' as const, autoApprove: true }, ['run', '/decompose-task', 'ABC-1', '--auto-approve']],
    [{ stage: 'decompose' as const, autoApprove: false }, ['run', '/decompose-task', 'ABC-1']],
    // extractor ignores mode + autoApprove
    [{ stage: 'extractor' as const, mode: 'quick' as const, autoApprove: true }, ['run', '/extractor-task', 'ABC-1']],
  ])('builds args %j', async (opts, expectedArgs) => {
    const promise = runPipelineStage({ taskKey: 'ABC-1', ...opts });
    proc.emitStdout('[DECOMPOSE_DONE][EXTRACTOR_DONE][VERDICT][SOLUTION_DONE][EXECUTE_DONE]\n');
    proc.close(0);
    await promise;

    expect(spawn.mock.calls[0][1]).toEqual(expectedArgs);
  });
});

describe('runPipelineStage stdout handling', () => {
  it('resolves with the trimmed wire line and reports progress per line', async () => {
    const onProgress = vi.fn();
    const onDone = vi.fn();
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'analyze', onProgress, onDone });

    proc.emitStdout('starting\nworking\n  [VERDICT] PASS  \n');
    proc.close(0);

    await expect(promise).resolves.toBe('[VERDICT] PASS');
    expect(onProgress.mock.calls.map(c => c[0])).toEqual(['starting', 'working', '  [VERDICT] PASS  ']);
    expect(onDone).toHaveBeenCalledExactlyOnceWith('[VERDICT] PASS');
  });

  it('buffers partial lines across chunks instead of splitting the wire signal', async () => {
    const onProgress = vi.fn();
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'analyze', onProgress });

    proc.emitStdout('[VER');
    expect(onProgress).not.toHaveBeenCalled();
    proc.emitStdout('DICT] PASS\n');
    proc.close(0);

    await expect(promise).resolves.toBe('[VERDICT] PASS');
    expect(onProgress.mock.calls.map(c => c[0])).toEqual(['[VERDICT] PASS']);
  });

  it('flushes a trailing line that has no newline when the process closes', async () => {
    const onProgress = vi.fn();
    const onDone = vi.fn();
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'analyze', onProgress, onDone });

    proc.emitStdout('[VERDICT] PASS');
    proc.close(0);

    await expect(promise).resolves.toBe('[VERDICT] PASS');
    expect(onProgress).toHaveBeenCalledExactlyOnceWith('[VERDICT] PASS');
    expect(onDone).toHaveBeenCalledExactlyOnceWith('[VERDICT] PASS');
  });

  it('forwards stderr chunks to onError without failing the run', async () => {
    const onError = vi.fn();
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'analyze', onError });

    proc.emitStderr('warning: slow\n');
    proc.emitStdout('[VERDICT] PASS\n');
    proc.close(0);

    await expect(promise).resolves.toBe('[VERDICT] PASS');
    expect(onError).toHaveBeenCalledExactlyOnceWith('warning: slow\n');
  });

  it('only matches the wire signal of the requested stage', async () => {
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'solution' });

    proc.emitStdout('[VERDICT] PASS\n');
    proc.close(0);

    await expect(promise).rejects.toThrowError('Wire signal "[SOLUTION_DONE]" not found in output');
  });
});

describe('runPipelineStage failure modes', () => {
  it('rejects when the process exits non-zero without a wire signal', async () => {
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'analyze' });

    proc.emitStdout('boom\n');
    proc.close(3);

    await expect(promise).rejects.toThrowError('OpenCode exited with code 3');
  });

  it('rejects when a wire signal is followed by a non-zero exit', async () => {
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'analyze' });

    proc.emitStdout('[VERDICT] PASS\n');
    proc.close(1);

    await expect(promise).rejects.toThrowError(
      'OpenCode exited with code 1 after emitting wire signal',
    );
  });

  it('rejects when the process exits 0 but never emits the wire signal', async () => {
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'execute' });

    proc.emitStdout('nothing useful\n');
    proc.close(0);

    await expect(promise).rejects.toThrowError('Wire signal "[EXECUTE_DONE]" not found in output');
  });

  it('rejects with the spawn error when the CLI cannot be launched', async () => {
    const promise = runPipelineStage({ taskKey: 'ABC-1', stage: 'analyze' });

    proc.emit('error', new Error('spawn opencode ENOENT'));

    await expect(promise).rejects.toThrowError('spawn opencode ENOENT');
  });
});
