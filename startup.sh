#!/bin/bash

#===============================================================================
# LogoScraper Pro - 开发环境启动脚本
# 兼容: macOS, Linux, Windows (Git Bash/WSL)
# 架构: x86_64 (AMD64), arm64 (ARM64), aarch64
#===============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# 日志函数
log_info()    { echo -e "${CYAN}[INFO]${NC}    $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $1"; }
log_step()    { echo -e "${BLUE}[STEP]${NC}    $1"; }
log_debug()   { [[ "$DEBUG" == "true" ]] && echo -e "${WHITE}[DEBUG]${NC}   $1"; }

# 分隔线
print_separator() {
    echo -e "${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 打印标题
print_header() {
    print_separator
    echo -e "${WHITE}   LogoScraper Pro - 开发环境启动器${NC}"
    echo -e "${WHITE}   $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    print_separator
}

#-------------------------------------------------------------------------------
# 系统与架构检测
#-------------------------------------------------------------------------------
detect_system() {
    log_step "检测操作系统与架构..."
    
    # 检测操作系统
    OS_TYPE="unknown"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS_TYPE="macOS"
        OS_NAME="macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS_TYPE="Linux"
        # 检测具体 Linux 发行版
        if [[ -f /etc/os-release ]]; then
            . /etc/os-release
            OS_NAME="$NAME"
        elif command -v lsb_release &> /dev/null; then
            OS_NAME=$(lsb_release -d | cut -f2)
        else
            OS_NAME="Linux"
        fi
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS_TYPE="Windows"
        OS_NAME="Windows (Git Bash)"
    elif [[ "$OSTYPE" == "win32" ]]; then
        OS_TYPE="Windows"
        OS_NAME="Windows"
    else
        OS_TYPE="$OSTYPE"
        OS_NAME="Unknown"
    fi
    
    # 检测架构
    ARCH_RAW=$(uname -m)
    case "$ARCH_RAW" in
        x86_64|amd64|AMD64)
            ARCH="x86_64"
            ARCH_NAME="AMD64 (Intel/AMD 64位)"
            ;;
        arm64|aarch64|ARM64)
            ARCH="arm64"
            ARCH_NAME="ARM64 (Apple Silicon / ARM)"
            ;;
        armv7l|armhf)
            ARCH="arm"
            ARCH_NAME="ARM (32位)"
            ;;
        i386|i686|x86)
            ARCH="x86"
            ARCH_NAME="Intel 32位"
            ;;
        *)
            ARCH="$ARCH_RAW"
            ARCH_NAME="$ARCH_RAW"
            ;;
    esac
    
    log_info "操作系统: $OS_NAME"
    log_info "系统类型: $OS_TYPE"
    log_info "硬件架构: $ARCH_NAME ($ARCH)"
    log_success "系统检测完成"
}

#-------------------------------------------------------------------------------
# 依赖检查
#-------------------------------------------------------------------------------
check_node() {
    log_step "检查 Node.js 环境..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装！"
        log_info "请访问 https://nodejs.org/ 下载安装"
        log_info "推荐版本: Node.js 18.x 或更高"
        return 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    
    log_info "Node.js 版本: v$NODE_VERSION"
    
    if [[ "$NODE_MAJOR" -lt 18 ]]; then
        log_warn "Node.js 版本过低，推荐 18.x 或更高"
        log_warn "当前版本可能存在兼容性问题"
    else
        log_success "Node.js 版本满足要求"
    fi
    
    return 0
}

check_npm() {
    log_step "检查 npm..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装！"
        return 1
    fi
    
    NPM_VERSION=$(npm -v)
    log_info "npm 版本: $NPM_VERSION"
    log_success "npm 已就绪"
    
    return 0
}

check_rust() {
    log_step "检查 Rust 环境 (可选)..."
    
    if command -v rustc &> /dev/null; then
        RUST_VERSION=$(rustc --version)
        log_info "Rust: $RUST_VERSION"
        
        if command -v cargo &> /dev/null; then
            CARGO_VERSION=$(cargo --version)
            log_info "Cargo: $CARGO_VERSION"
            log_success "Rust 工具链已就绪 (可用于 WASM 编译)"
        fi
    else
        log_info "Rust 未安装 (可选依赖，不影响前端开发)"
        log_debug "如需编译 WASM，请访问 https://rustup.rs/"
    fi
    
    return 0
}

#-------------------------------------------------------------------------------
# 环境准备
#-------------------------------------------------------------------------------
install_dependencies() {
    log_step "检查项目依赖..."
    
    # 检查 package.json 是否存在
    if [[ ! -f "package.json" ]]; then
        log_error "package.json 未找到！"
        log_error "请确保在项目根目录运行此脚本"
        return 1
    fi
    
    # 检查 node_modules
    if [[ ! -d "node_modules" ]]; then
        log_info "node_modules 不存在，开始安装依赖..."
        
        # 选择包管理器
        PM="npm"
        PM_CMD="npm install"
        
        if command -v pnpm &> /dev/null; then
            PM="pnpm"
            PM_CMD="pnpm install"
            log_info "检测到 pnpm，使用 pnpm 安装 (更快)"
        elif command -v yarn &> /dev/null; then
            PM="yarn"
            PM_CMD="yarn install"
            log_info "检测到 yarn，使用 yarn 安装"
        fi
        
        log_info "执行: $PM_CMD"
        
        # 执行安装
        if $PM_CMD; then
            log_success "依赖安装完成"
        else
            log_error "依赖安装失败！"
            return 1
        fi
    else
        log_info "node_modules 已存在"
        
        # 检查是否需要更新
        PKG_COUNT=$(ls node_modules | wc -l | tr -d ' ')
        log_debug "已安装 $PKG_COUNT 个包"
        
        log_success "依赖已就绪"
    fi
    
    return 0
}

#-------------------------------------------------------------------------------
# 启动开发服务器
#-------------------------------------------------------------------------------
start_dev_server() {
    log_step "启动开发服务器..."
    
    # 检查 vite 是否可用
    if [[ ! -f "node_modules/.bin/vite" ]]; then
        log_error "Vite 未安装！请先运行依赖安装"
        return 1
    fi
    
    # 获取本机 IP (用于显示访问地址)
    LOCAL_IP=""
    if [[ "$OS_TYPE" == "macOS" ]]; then
        LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
    elif [[ "$OS_TYPE" == "Linux" ]]; then
        LOCAL_IP=$(hostname -I 2>/dev/null | cut -d' ' -f1 || echo "")
    fi
    
    print_separator
    log_success "开发服务器即将启动..."
    echo ""
    log_info "本地访问: http://localhost:5173"
    if [[ -n "$LOCAL_IP" ]]; then
        log_info "局域网访问: http://$LOCAL_IP:5173"
    fi
    echo ""
    log_warn "按 Ctrl+C 停止服务器"
    print_separator
    echo ""
    
    # 启动 Vite 开发服务器
    npm run dev
}

#-------------------------------------------------------------------------------
# 清理函数
#-------------------------------------------------------------------------------
cleanup() {
    echo ""
    log_info "正在退出..."
    log_success "感谢使用 LogoScraper Pro！"
    print_separator
}

#-------------------------------------------------------------------------------
# 主流程
#-------------------------------------------------------------------------------
main() {
    # 注册退出处理
    trap cleanup EXIT
    
    # 打印标题
    print_header
    
    # 1. 检测系统
    detect_system
    echo ""
    
    # 2. 检查 Node.js
    if ! check_node; then
        exit 1
    fi
    echo ""
    
    # 3. 检查 npm
    if ! check_npm; then
        exit 1
    fi
    echo ""
    
    # 4. 检查 Rust (可选)
    check_rust
    echo ""
    
    # 5. 安装依赖
    if ! install_dependencies; then
        exit 1
    fi
    echo ""
    
    # 6. 启动开发服务器
    start_dev_server
}

#-------------------------------------------------------------------------------
# 参数处理
#-------------------------------------------------------------------------------
DEBUG="false"
SKIP_INSTALL="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --debug|-d)
            DEBUG="true"
            shift
            ;;
        --skip-install|-s)
            SKIP_INSTALL="true"
            shift
            ;;
        --help|-h)
            echo "用法: ./startup.sh [选项]"
            echo ""
            echo "选项:"
            echo "  --debug, -d     启用调试日志"
            echo "  --skip-install  跳过依赖安装检查"
            echo "  --help, -h      显示帮助信息"
            echo ""
            echo "示例:"
            echo "  ./startup.sh              # 正常启动"
            echo "  ./startup.sh --debug      # 调试模式"
            echo "  ./startup.sh --skip-install  # 跳过安装"
            exit 0
            ;;
        *)
            log_warn "未知参数: $1"
            shift
            ;;
    esac
done

# 运行主流程
main