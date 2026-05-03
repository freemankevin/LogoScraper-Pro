/* tslint:disable */
/* eslint-disable */

/**
 * 压缩图像并返回 PNG 字节
 *
 * # Arguments
 * * `data` - 输入图像字节 (Uint8Array)
 * * `max_width` - 最大宽度
 * * `_quality` - 质量参数 (保留)
 */
export function compress_image(data: Uint8Array, max_width: number, _quality: number): Uint8Array;

/**
 * 格式转换
 *
 * # Arguments
 * * `data` - 输入图像字节
 * * `target_format` - 目标格式: "png", "jpeg", "webp", "bmp"
 */
export function convert_format(data: Uint8Array, target_format: string): Uint8Array;

/**
 * 将图像转换为简化 SVG
 *
 * # Arguments
 * * `data` - 输入图像字节
 * * `target_size` - 矢量化目标尺寸（越大越精确但越慢）
 */
export function image_to_svg(data: Uint8Array, target_size: number): string;

/**
 * 初始化 WASM 模块（可在此做一次性设置）
 */
export function start(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly compress_image: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly convert_format: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly image_to_svg: (a: number, b: number, c: number, d: number) => void;
    readonly start: () => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
