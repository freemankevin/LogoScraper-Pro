use wasm_bindgen::prelude::*;
use crate::processor;

/// 压缩图像并返回 PNG 字节
/// 
/// # Arguments
/// * `data` - 输入图像字节 (Uint8Array)
/// * `max_width` - 最大宽度
/// * `_quality` - 质量参数 (保留)
#[wasm_bindgen]
pub fn compress_image(data: &[u8], max_width: u32, _quality: u8) -> Result<Vec<u8>, String> {
    processor::compress_image(data, max_width, _quality)
}

/// 将图像转换为简化 SVG
/// 
/// # Arguments
/// * `data` - 输入图像字节
/// * `target_size` - 矢量化目标尺寸（越大越精确但越慢）
#[wasm_bindgen]
pub fn image_to_svg(data: &[u8], target_size: u32) -> Result<String, String> {
    processor::image_to_svg(data, target_size)
}

/// 格式转换
/// 
/// # Arguments
/// * `data` - 输入图像字节
/// * `target_format` - 目标格式: "png", "jpeg", "webp", "bmp"
#[wasm_bindgen]
pub fn convert_format(data: &[u8], target_format: &str) -> Result<Vec<u8>, String> {
    processor::convert_format(data, target_format)
}

/// 初始化 WASM 模块（可在此做一次性设置）
#[wasm_bindgen(start)]
pub fn start() {
    // 可在此初始化日志等
}
