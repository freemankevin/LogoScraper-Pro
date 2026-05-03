# Supabase S3 Storage 污染检测脚本

用于批量审计 LogoScraper Pro 存储在 Supabase Storage 中的 SVG 文件，检测异常/损坏/污染数据。

---

## 一、你需要 S3 凭证吗？

**是的**，Supabase Storage 提供 S3 兼容协议，需要专门生成 **S3 Access Key**，不能直接使用前端用的 `VITE_SUPABASE_ANON_KEY`。

### 权限建议（最小权限原则）

| 操作需求 | 所需权限 | 推荐做法 |
|---------|---------|---------|
| **仅扫描/审计** | `s3:ListBucket`、`s3:GetObject` | ✅ 最安全，推荐先用此权限运行 |
| **扫描 + 隔离** | 上述 + `s3:PutObject`、`s3:DeleteObject` | 需要写权限，建议确认污染后再操作 |
| **扫描 + 删除** | 上述 + `s3:DeleteObject` | ⚠️ 不可逆，操作前务必备份 |

**不建议创建"超级管理员/root"级别的高权限 Key**，只给目标 Bucket（`logos`）的最小必要权限即可。

---

## 二、如何获取 S3 Access Key

### 方式 A：Supabase Dashboard（推荐）

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入你的项目 → 左侧菜单 **Storage（存储）**
3. 点击顶部 **S3 Access Keys** 标签页
4. 点击 **New Access Key**
5. 给 Key 起个名字（例如 `logo-audit-readonly`）
6. 选择权限范围：
   - 如果仅审计 → 勾选 **Read-only**（或手动选择 `ListObjects`、`GetObject`）
   - 如果需要清理 → 勾选 **Read / Write**（或手动加上 `PutObject`、`DeleteObject`）
7. 复制生成的 **Access Key ID** 和 **Secret Access Key**（Secret 只显示一次，请妥善保存）

### 方式 B：通过 SQL / API（高级）

如果 Dashboard 中未找到 S3 Access Keys 选项（部分老项目可能需要先在 Storage Settings 中启用 S3 Protocol），可以：

1. 进入 Project Settings → Storage
2. 确认 **S3 Protocol** 已启用
3. 再按方式 A 创建 Key

---

## 三、配置与运行

### 1. 安装依赖

```bash
cd tools/s3-audit
pip install -r requirements.txt
```

### 2. 配置环境变量

编辑项目根目录的 `.env`（没有就复制根目录的 `.env.example`），填入你从 Dashboard 获取的凭证：

```env
S3_ENDPOINT_URL=https://dxtqakgynfmijksjectu.storage.supabase.co/storage/v1/s3
S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=你的_Access_Key_ID
S3_SECRET_ACCESS_KEY=你的_Secret_Access_Key
S3_BUCKET_NAME=logos

# 以下使用默认值即可，按需调整
S3_AUDIT_MODE=scan
S3_QUARANTINE_PREFIX=quarantine/
S3_DOWNLOAD_TIMEOUT=30
S3_MIN_FILE_SIZE=10
S3_MAX_FILE_SIZE=10485760
```

> **注意**：`S3_ENDPOINT_URL` 中 `dxtqakgynfmijksjectu` 是你的 Project Ref，请确认与 Dashboard 中显示的一致。

### 3. 运行脚本

#### 扫描检测（安全，推荐先用这个）

```bash
python audit_s3.py --mode scan
```

#### 关键词搜索（只查看，不下载）

```bash
# 搜索文件名含 "chrome" 的 SVG
python audit_s3.py --mode search --keyword chrome

# 支持 * 通配符
python audit_s3.py --mode search --keyword "google*"

# 搜索特定前缀下含 "logo" 的文件
python audit_s3.py --mode search --prefix "brands/" --keyword logo
```

#### 批量下载

```bash
# 下载所有含 "google" 的文件到 ./downloads/
python audit_s3.py --mode download --keyword google -o ./downloads

# 下载全部文件
python audit_s3.py --mode download -o ./downloads

# 下载特定前缀下的文件
python audit_s3.py --mode download --prefix "brands/" -o ./downloads
```

#### 扫描 + 隔离污染文件

```bash
python audit_s3.py --mode quarantine
```

#### 删除污染文件（⚠️ 不可逆，谨慎使用）

```bash
# 交互模式（需要输入 yes 确认）
python audit_s3.py --mode delete

# 非交互模式（脚本自动化时使用）
python audit_s3.py --mode delete --yes
```

#### 上传单个文件

```bash
python audit_s3.py --mode upload --file ./mylogo.svg --key mylogo.svg
```

#### 批量上传目录（保持目录结构）

```bash
# 上传整个目录到 S3 根目录
python audit_s3.py --mode batch-upload --input-dir ./svgs/

# 上传并加上前缀
python audit_s3.py --mode batch-upload --input-dir ./svgs/ --prefix brands/
```

#### 调整并发数（默认 8）

```bash
python audit_s3.py --mode scan --workers 16
```

---

## 四、自动排除

脚本会自动排除 Supabase Storage 生成的占位符文件（如 `.emptyFolderPlaceholder`），这些文件不参与扫描、下载、删除等任何操作。

## 五、检测规则（何为"污染"）

脚本会逐文件检查以下项目：

| 检查项 | 判定标准 | 说明 |
|-------|---------|------|
| 空文件 | `size == 0` | 上传中断或失败残留 |
| 过小文件 | `< MIN_FILE_SIZE`（默认 10 字节） | 可能是错误占位符 |
| 过大文件 | `> MAX_FILE_SIZE`（默认 10MB） | Logo SVG 通常很小，过大可能是异常 |
| 非 `.svg` 扩展名 | 文件名不以 `.svg` 结尾 | 项目规范要求均为 SVG |
| 异常 Content-Type | 不为 `image/svg+xml` | MIME 类型被错误设置 |
| 下载失败 | S3 GetObject 报错 | 权限问题或对象损坏 |
| 非合法 SVG 头 | 文件内容开头不是 `<svg`、`<?xml`、`<!--`、`<!DOCTYPE svg` | 文件内容被篡改/损坏/混入 HTML/JSON 等 |

> 参考项目源码 `src/lib/supabase-client.ts` 第 90 行，前端本身也会做类似的 SVG 头校验，此脚本将其自动化批量执行。

---

## 六、输出报告

脚本会在终端输出彩色汇总表，同时默认导出到 `./reports/` 目录：

- `audit_YYYYMMDD_HHMMSS.csv` — Excel 可打开的表格
- `audit_YYYYMMDD_HHMMSS.json` — 供程序二次处理

如果不想导出报告，加 `--no-export` 参数。

---

## 七、如果数据真的被污染了，建议的修复流程

```
Step 1: 用 scan 模式运行，确认污染文件列表
        python audit_s3.py --mode scan

Step 2: 查看 CSV/JSON 报告，人工抽查确认

Step 3: 先用 quarantine 模式隔离（可恢复）
        python audit_s3.py --mode quarantine

Step 4: 确认隔离无误后，若需彻底清理，再 delete
        python audit_s3.py --mode delete
```

---

## 八、常见问题

**Q: 提示 `SignatureDoesNotMatch` 或连接失败？**  
A: 检查 `.env` 中的 `S3_ACCESS_KEY_ID` 和 `S3_SECRET_ACCESS_KEY` 是否复制完整（Secret 中可能包含特殊字符，建议直接粘贴，不要手打）。

**Q: 提示 `NoSuchBucket`？**  
A: 确认 `S3_BUCKET_NAME=logos` 正确，且该 Bucket 已在 Supabase Storage 中创建。

**Q: 扫描到很多 `下载失败`？**  
A: 可能是 Key 权限不足（缺少 `s3:GetObject`），或对象实际上已被删除但列表未刷新。尝试更换一个更高权限的 Key 重新扫描。

**Q: 我想只读，但 Dashboard 里只有 Read/Write 选项？**  
A: Supabase 部分版本的 S3 Key 只提供 "Read / Write" 和 "Admin" 两档，选择 Read/Write 即可，脚本默认 `scan` 模式不会写入，是安全的。
