#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Supabase S3 Storage 污染检测与批处理脚本
用途：扫描 logos bucket 中的异常/损坏 SVG 文件，支持审计、隔离、删除、搜索、下载、上传

环境准备:
    pip3 install -r requirements.txt
    # 编辑项目根目录 .env 填入 S3 凭证
    python audit_s3.py
"""

import os
import sys
import csv
import json
import fnmatch
import argparse
import mimetypes
from datetime import datetime
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from tabulate import tabulate
from termcolor import colored

# ---------------------------------------------------------------------------
# 脚本目录（所有 IO 路径以此为基准，不依赖执行时的 cwd）
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_REPORTS_DIR = os.path.join(SCRIPT_DIR, "reports")
DEFAULT_DOWNLOADS_DIR = os.path.join(SCRIPT_DIR, "downloads")

# ---------------------------------------------------------------------------
# 加载环境变量（从当前目录或父目录找 .env）
# ---------------------------------------------------------------------------
load_dotenv()
load_dotenv(os.path.join(SCRIPT_DIR, "..", "..", ".env"))

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "")
S3_REGION = os.getenv("S3_REGION", "ap-southeast-1")
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "")
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "logos")

MODE = os.getenv("S3_AUDIT_MODE", "scan")
QUARANTINE_PREFIX = os.getenv("S3_QUARANTINE_PREFIX", "quarantine/")
DOWNLOAD_TIMEOUT = int(os.getenv("S3_DOWNLOAD_TIMEOUT", "30"))
MIN_FILE_SIZE = int(os.getenv("S3_MIN_FILE_SIZE", "10"))
MAX_FILE_SIZE = int(os.getenv("S3_MAX_FILE_SIZE", "10485760"))  # 10MB

# 默认排除的 Supabase 自动生成的占位符文件
DEFAULT_EXCLUDED_KEYS = {".emptyFolderPlaceholder"}

# 合法的 SVG 文件头
SVG_SIGNATURES = (b"<svg", b"<?xml", b"<!--", b"<!DOCTYPE svg")


# ---------------------------------------------------------------------------
# 颜色与日志
# ---------------------------------------------------------------------------
def log_info(msg: str) -> None:
    print(colored(f"[INFO] {msg}", "cyan"))


def log_ok(msg: str) -> None:
    print(colored(f"[OK]   {msg}", "green"))


def log_warn(msg: str) -> None:
    print(colored(f"[WARN] {msg}", "yellow"))


def log_err(msg: str) -> None:
    print(colored(f"[ERR]  {msg}", "red"))


def log_fatal(msg: str) -> None:
    print(colored(f"[FATAL] {msg}", "red", attrs=["bold"]))
    sys.exit(1)


# ---------------------------------------------------------------------------
# S3 客户端
# ---------------------------------------------------------------------------
def get_s3_client() -> boto3.client:
    if not all([S3_ENDPOINT_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY]):
        log_fatal(
            "S3 凭证未配置完整。请检查项目根目录 .env 文件中的:\n"
            "  S3_ENDPOINT_URL\n  S3_ACCESS_KEY_ID\n  S3_SECRET_ACCESS_KEY"
        )

    config = Config(
        region_name=S3_REGION,
        signature_version="s3v4",
        retries={"max_attempts": 3, "mode": "adaptive"},
    )

    try:
        client = boto3.client(
            "s3",
            endpoint_url=S3_ENDPOINT_URL,
            aws_access_key_id=S3_ACCESS_KEY_ID,
            aws_secret_access_key=S3_SECRET_ACCESS_KEY,
            config=config,
        )
        client.head_bucket(Bucket=S3_BUCKET_NAME)
        log_ok(f"已连接到 Bucket: {S3_BUCKET_NAME}")
        return client
    except ClientError as e:
        log_fatal(f"连接 S3 失败: {e}")
    except Exception as e:
        log_fatal(f"初始化 S3 客户端失败: {e}")


# ---------------------------------------------------------------------------
# 对象遍历（自动排除占位符）
# ---------------------------------------------------------------------------
def list_objects(client: boto3.client, prefix: str = "") -> list[dict]:
    """列出 bucket 中所有对象（支持前缀过滤，自动排除占位符）"""
    objects: list[dict] = []
    paginator = client.get_paginator("list_objects_v2")

    log_info(f"正在列出对象 (prefix='{prefix}')...")
    page_count = 0
    excluded = 0
    for page in paginator.paginate(Bucket=S3_BUCKET_NAME, Prefix=prefix):
        page_count += 1
        chunk = page.get("Contents", [])
        for obj in chunk:
            key = obj.get("Key", "")
            if key in DEFAULT_EXCLUDED_KEYS:
                excluded += 1
                continue
            objects.append(obj)
        if chunk:
            log_info(f"  第 {page_count} 页: +{len(chunk)} 个对象")

    if excluded:
        log_info(f"已自动排除 {excluded} 个占位符文件")
    log_ok(f"共发现 {len(objects)} 个有效对象")
    return objects


def filter_by_keyword(objects: list[dict], keyword: str) -> list[dict]:
    """按关键词过滤对象列表（不区分大小写，支持 * 通配符）"""
    if not keyword:
        return objects
    pattern = f"*{keyword}*" if "*" not in keyword else keyword
    filtered = [obj for obj in objects if fnmatch.fnmatch(obj["Key"].lower(), pattern.lower())]
    log_info(f"关键词 '{keyword}' 匹配到 {len(filtered)} 个对象")
    return filtered


# ---------------------------------------------------------------------------
# 污染检测
# ---------------------------------------------------------------------------
class ContaminationReport:
    def __init__(
        self,
        key: str,
        size: int,
        content_type: Optional[str],
        last_modified: Optional[str],
        is_empty: bool = False,
        is_oversize: bool = False,
        is_undersize: bool = False,
        wrong_extension: bool = False,
        wrong_content_type: bool = False,
        download_failed: bool = False,
        bad_header: bool = False,
        error_msg: str = "",
    ):
        self.key = key
        self.size = size
        self.content_type = content_type
        self.last_modified = last_modified
        self.is_empty = is_empty
        self.is_oversize = is_oversize
        self.is_undersize = is_undersize
        self.wrong_extension = wrong_extension
        self.wrong_content_type = wrong_content_type
        self.download_failed = download_failed
        self.bad_header = bad_header
        self.error_msg = error_msg

    @property
    def is_clean(self) -> bool:
        return not any(
            [
                self.is_empty,
                self.is_oversize,
                self.is_undersize,
                self.wrong_extension,
                self.wrong_content_type,
                self.download_failed,
                self.bad_header,
            ]
        )

    @property
    def issues(self) -> list[str]:
        issues: list[str] = []
        if self.is_empty:
            issues.append("空文件")
        if self.is_undersize:
            issues.append(f"过小(<{MIN_FILE_SIZE}B)")
        if self.is_oversize:
            issues.append(f"过大(>{MAX_FILE_SIZE}B)")
        if self.wrong_extension:
            issues.append("非.svg扩展名")
        if self.wrong_content_type:
            issues.append(f"异常ContentType({self.content_type})")
        if self.download_failed:
            issues.append(f"下载失败({self.error_msg})")
        if self.bad_header:
            issues.append("非合法SVG头")
        return issues if issues else ["正常"]


def inspect_object(
    client: boto3.client, key: str, size: int, content_type: Optional[str], last_modified: Optional[str]
) -> ContaminationReport:
    """对单个对象执行完整检测"""
    report = ContaminationReport(
        key=key,
        size=size,
        content_type=content_type,
        last_modified=last_modified,
    )

    if size == 0:
        report.is_empty = True
        return report

    if size < MIN_FILE_SIZE:
        report.is_undersize = True
    if size > MAX_FILE_SIZE:
        report.is_oversize = True

    if not key.lower().endswith(".svg"):
        report.wrong_extension = True

    if content_type and not content_type.startswith("image/svg"):
        report.wrong_content_type = True

    try:
        resp = client.get_object(Bucket=S3_BUCKET_NAME, Key=key)
        body = resp["Body"]
        header = body.read(4096)
        body.close()

        stripped = header.lstrip()
        if not any(stripped.startswith(sig) for sig in SVG_SIGNATURES):
            report.bad_header = True
    except ClientError as e:
        report.download_failed = True
        report.error_msg = str(e.response.get("Error", {}).get("Code", e))
    except Exception as e:
        report.download_failed = True
        report.error_msg = str(e)

    return report


# ---------------------------------------------------------------------------
# 批量扫描
# ---------------------------------------------------------------------------
def scan_bucket(
    client: boto3.client,
    prefix: str = "",
    keyword: str = "",
    max_workers: int = 8,
) -> list[ContaminationReport]:
    objects = list_objects(client, prefix=prefix)
    objects = filter_by_keyword(objects, keyword)

    total = len(objects)
    if total == 0:
        log_warn("没有需要检测的对象")
        return []

    log_info(f"开始并行检测 (workers={max_workers})...")
    reports: list[ContaminationReport] = []
    done = 0

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(
                inspect_object,
                client,
                obj["Key"],
                obj["Size"],
                obj.get("ContentType"),
                obj.get("LastModified").isoformat() if obj.get("LastModified") else None,
            ): obj
            for obj in objects
        }
        for future in as_completed(futures):
            done += 1
            reports.append(future.result())
            if done % 50 == 0 or done == total:
                print(f"\r  进度: {done}/{total} ({done * 100 // total}%)", end="", flush=True)

    print()
    return reports


# ---------------------------------------------------------------------------
# 搜索模式
# ---------------------------------------------------------------------------
def run_search(client: boto3.client, prefix: str = "", keyword: str = "", max_workers: int = 8) -> list[dict]:
    objects = list_objects(client, prefix=prefix)
    objects = filter_by_keyword(objects, keyword)

    if not objects:
        return []

    log_info("正在获取匹配对象的头部信息...")
    results: list[dict] = []
    done = 0

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        def _peek(obj: dict) -> dict:
            try:
                resp = client.get_object(Bucket=S3_BUCKET_NAME, Key=obj["Key"])
                body = resp["Body"]
                header = body.read(4096)
                body.close()
                stripped = header.lstrip()
                is_svg = any(stripped.startswith(sig) for sig in SVG_SIGNATURES)
                preview = header[:200].decode("utf-8", errors="replace").replace("\n", " ")
                return {
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj.get("LastModified", "").isoformat() if obj.get("LastModified") else "",
                    "is_svg": is_svg,
                    "preview": preview[:80] + ("..." if len(preview) > 80 else ""),
                }
            except Exception as e:
                return {
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj.get("LastModified", "").isoformat() if obj.get("LastModified") else "",
                    "is_svg": False,
                    "preview": f"[读取失败: {e}]",
                }

        futures = {pool.submit(_peek, obj): obj for obj in objects}
        for future in as_completed(futures):
            done += 1
            results.append(future.result())
            if done % 50 == 0 or done == len(objects):
                print(f"\r  进度: {done}/{len(objects)} ({done * 100 // len(objects)}%)", end="", flush=True)

    print()
    return results


def print_search_results(results: list[dict]) -> None:
    if not results:
        log_warn("无匹配结果")
        return

    print()
    print(colored(f"搜索结果 ({len(results)} 条)", "blue", attrs=["bold"]))

    rows = []
    for r in results:
        size_str = f"{r['size']} B" if r['size'] < 1024 else f"{r['size'] / 1024:.1f} KB"
        svg_status = colored("✓ SVG", "green") if r["is_svg"] else colored("✗ 非SVG", "red")
        rows.append([
            r["key"][:55] + ("..." if len(r["key"]) > 55 else ""),
            size_str,
            svg_status,
            r["preview"],
        ])

    print(tabulate(rows, headers=["文件名", "大小", "类型", "内容预览"], tablefmt="grid"))


# ---------------------------------------------------------------------------
# 下载模式
# ---------------------------------------------------------------------------
def run_download(
    client: boto3.client,
    prefix: str = "",
    keyword: str = "",
    output_dir: str = DEFAULT_DOWNLOADS_DIR,
    max_workers: int = 8,
) -> None:
    objects = list_objects(client, prefix=prefix)
    objects = filter_by_keyword(objects, keyword)

    if not objects:
        log_warn("没有需要下载的对象")
        return

    os.makedirs(output_dir, exist_ok=True)
    log_info(f"即将下载 {len(objects)} 个文件到: {os.path.abspath(output_dir)}")

    done = 0
    success = 0
    failed = 0

    def _download(obj: dict) -> tuple[str, bool, str]:
        key = obj["Key"]
        local_path = os.path.join(output_dir, key)
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        try:
            client.download_file(S3_BUCKET_NAME, key, local_path)
            return key, True, ""
        except Exception as e:
            return key, False, str(e)

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_download, obj): obj for obj in objects}
        for future in as_completed(futures):
            done += 1
            key, ok, err = future.result()
            if ok:
                success += 1
                print(colored(f"  ✓ {key}", "green"))
            else:
                failed += 1
                print(colored(f"  ✗ {key} — {err}", "red"))
            if done % 10 == 0 or done == len(objects):
                print(f"\r  进度: {done}/{len(objects)}", end="", flush=True)

    print()
    print()
    print(colored("=" * 50, "blue"))
    print(colored("下载完成", "blue", attrs=["bold"]))
    print(f"  成功: {colored(str(success), 'green')}")
    print(f"  失败: {colored(str(failed), 'red') if failed else '0'}")
    print(colored("=" * 50, "blue"))


# ---------------------------------------------------------------------------
# 上传模式
# ---------------------------------------------------------------------------
def run_upload(
    client: boto3.client,
    file_path: str,
    key: Optional[str] = None,
    content_type: Optional[str] = None,
) -> None:
    """上传单个文件到 S3"""
    if not os.path.isfile(file_path):
        log_fatal(f"文件不存在: {file_path}")

    if key is None:
        key = os.path.basename(file_path)

    if content_type is None:
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            content_type = "application/octet-stream"
        if file_path.lower().endswith(".svg"):
            content_type = "image/svg+xml"

    size = os.path.getsize(file_path)
    log_info(f"正在上传: {file_path} -> s3://{S3_BUCKET_NAME}/{key} ({size} B, {content_type})")

    try:
        extra_args = {"ContentType": content_type}
        client.upload_file(file_path, S3_BUCKET_NAME, key, ExtraArgs=extra_args)
        log_ok(f"上传成功: {key}")
    except Exception as e:
        log_err(f"上传失败: {e}")


# ---------------------------------------------------------------------------
# 批量上传模式
# ---------------------------------------------------------------------------
def run_batch_upload(
    client: boto3.client,
    input_dir: str,
    prefix: str = "",
    max_workers: int = 8,
) -> None:
    """批量上传目录下的文件到 S3"""
    if not os.path.isdir(input_dir):
        log_fatal(f"目录不存在: {input_dir}")

    files: list[str] = []
    for root, _, filenames in os.walk(input_dir):
        for name in filenames:
            files.append(os.path.join(root, name))

    if not files:
        log_warn(f"目录为空: {input_dir}")
        return

    log_info(f"发现 {len(files)} 个文件，开始批量上传...")

    done = 0
    success = 0
    failed = 0

    def _upload(local_path: str) -> tuple[str, bool, str]:
        rel_path = os.path.relpath(local_path, input_dir)
        key = (prefix + rel_path).replace("\\", "/")

        content_type, _ = mimetypes.guess_type(local_path)
        if not content_type:
            content_type = "application/octet-stream"
        if local_path.lower().endswith(".svg"):
            content_type = "image/svg+xml"

        try:
            extra_args = {"ContentType": content_type}
            client.upload_file(local_path, S3_BUCKET_NAME, key, ExtraArgs=extra_args)
            return key, True, ""
        except Exception as e:
            return key, False, str(e)

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_upload, f): f for f in files}
        for future in as_completed(futures):
            done += 1
            key, ok, err = future.result()
            if ok:
                success += 1
                print(colored(f"  ✓ {key}", "green"))
            else:
                failed += 1
                print(colored(f"  ✗ {key} — {err}", "red"))
            if done % 10 == 0 or done == len(files):
                print(f"\r  进度: {done}/{len(files)}", end="", flush=True)

    print()
    print()
    print(colored("=" * 50, "blue"))
    print(colored("批量上传完成", "blue", attrs=["bold"]))
    print(f"  成功: {colored(str(success), 'green')}")
    print(f"  失败: {colored(str(failed), 'red') if failed else '0'}")
    print(colored("=" * 50, "blue"))


# ---------------------------------------------------------------------------
# 清空模式（保留占位符）
# ---------------------------------------------------------------------------
def run_purge(client: boto3.client, auto_confirm: bool = False) -> None:
    """清空 bucket 中所有对象，保留占位符文件"""
    objects = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=S3_BUCKET_NAME):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key not in DEFAULT_EXCLUDED_KEYS:
                objects.append(key)

    if not objects:
        log_ok("bucket 中无需要清理的文件")
        return

    log_warn(f"即将清空 bucket，删除 {len(objects)} 个对象（保留占位符）")
    if not auto_confirm:
        confirm = input(colored("确认清空? 输入 'yes' 继续: ", "red", attrs=["bold"]))
        if confirm.strip().lower() != "yes":
            log_info("操作已取消")
            return

    for key in objects:
        try:
            client.delete_object(Bucket=S3_BUCKET_NAME, Key=key)
            print(colored(f"  已删除: {key}", "green"))
        except Exception as e:
            log_err(f"删除失败 {key}: {e}")

    log_ok(f"清空完成，共删除 {len(objects)} 个对象")


# ---------------------------------------------------------------------------
# 操作模式（scan / delete / quarantine）
# ---------------------------------------------------------------------------
def execute_actions(
    client: boto3.client,
    reports: list[ContaminationReport],
    mode: str,
    auto_confirm: bool = False,
) -> None:
    dirty = [r for r in reports if not r.is_clean]
    if not dirty:
        log_ok("未发现污染文件，无需执行操作")
        return

    if mode == "scan":
        log_warn(f"扫描模式：发现 {len(dirty)} 个污染文件，未执行任何修改")
        return

    if mode == "delete":
        log_warn(f"即将删除 {len(dirty)} 个污染文件！")
        if not auto_confirm:
            confirm = input(colored("确认删除? 输入 'yes' 继续: ", "red", attrs=["bold"]))
            if confirm.strip().lower() != "yes":
                log_info("操作已取消")
                return
        for r in dirty:
            try:
                client.delete_object(Bucket=S3_BUCKET_NAME, Key=r.key)
                log_ok(f"已删除: {r.key}")
            except Exception as e:
                log_err(f"删除失败 {r.key}: {e}")
        return

    if mode == "quarantine":
        log_warn(f"即将隔离 {len(dirty)} 个污染文件到前缀 '{QUARANTINE_PREFIX}'")
        if not auto_confirm:
            confirm = input(colored("确认隔离? 输入 'yes' 继续: ", "yellow", attrs=["bold"]))
            if confirm.strip().lower() != "yes":
                log_info("操作已取消")
                return
        for r in dirty:
            dest = QUARANTINE_PREFIX + r.key.lstrip("/")
            try:
                client.copy_object(
                    Bucket=S3_BUCKET_NAME,
                    CopySource={"Bucket": S3_BUCKET_NAME, "Key": r.key},
                    Key=dest,
                )
                client.delete_object(Bucket=S3_BUCKET_NAME, Key=r.key)
                log_ok(f"已隔离: {r.key} -> {dest}")
            except Exception as e:
                log_err(f"隔离失败 {r.key}: {e}")
        return

    log_fatal(f"未知操作模式: {mode}")


# ---------------------------------------------------------------------------
# 报告输出
# ---------------------------------------------------------------------------
def print_summary(reports: list[ContaminationReport]) -> None:
    total = len(reports)
    dirty = [r for r in reports if not r.is_clean]
    clean_count = total - len(dirty)

    print()
    print(colored("=" * 60, "blue"))
    print(colored("扫描汇总", "blue", attrs=["bold"]))
    print(colored("=" * 60, "blue"))
    print(f"总对象数:   {total}")
    print(colored(f"正常文件:   {clean_count}", "green"))
    print(colored(f"污染文件:   {len(dirty)}", "red"))

    counters = {
        "空文件": sum(1 for r in dirty if r.is_empty),
        "过小文件": sum(1 for r in dirty if r.is_undersize),
        "过大文件": sum(1 for r in dirty if r.is_oversize),
        "非SVG扩展名": sum(1 for r in dirty if r.wrong_extension),
        "异常ContentType": sum(1 for r in dirty if r.wrong_content_type),
        "下载失败": sum(1 for r in dirty if r.download_failed),
        "非合法SVG头": sum(1 for r in dirty if r.bad_header),
    }
    print()
    for k, v in counters.items():
        if v > 0:
            print(f"  - {k}: {v}")
    print(colored("=" * 60, "blue"))


def print_dirty_table(reports: list[ContaminationReport], limit: int = 50) -> None:
    dirty = [r for r in reports if not r.is_clean]
    if not dirty:
        return

    print()
    print(colored(f"污染文件详情 (前 {min(limit, len(dirty))} 条)", "red", attrs=["bold"]))

    rows = []
    for r in dirty[:limit]:
        size_str = f"{r.size} B" if r.size < 1024 else f"{r.size / 1024:.1f} KB"
        rows.append([
            r.key[:60] + ("..." if len(r.key) > 60 else ""),
            size_str,
            ", ".join(r.issues),
        ])

    print(tabulate(rows, headers=["文件名", "大小", "问题"], tablefmt="grid"))

    if len(dirty) > limit:
        print(colored(f"  ... 还有 {len(dirty) - limit} 条记录未显示", "yellow"))


def export_csv(reports: list[ContaminationReport], out_path: str) -> None:
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "key", "size", "content_type", "last_modified",
            "is_clean", "issues", "error_msg"
        ])
        for r in reports:
            writer.writerow([
                r.key,
                r.size,
                r.content_type or "",
                r.last_modified or "",
                r.is_clean,
                ";".join(r.issues),
                r.error_msg,
            ])
    log_ok(f"CSV 报告已保存: {out_path}")


def export_json(reports: list[ContaminationReport], out_path: str) -> None:
    data = []
    for r in reports:
        data.append({
            "key": r.key,
            "size": r.size,
            "content_type": r.content_type,
            "last_modified": r.last_modified,
            "is_clean": r.is_clean,
            "issues": r.issues,
            "error_msg": r.error_msg,
        })
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    log_ok(f"JSON 报告已保存: {out_path}")


# ---------------------------------------------------------------------------
# 主函数
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Supabase S3 Storage 审计脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
操作模式说明:
  scan        - 扫描检测污染（默认）
  delete      - 删除污染文件（不可逆！）
  quarantine  - 隔离污染文件（可恢复）
  search      - 关键词搜索文件（不下载）
  download    - 关键词搜索并下载文件到本地
  upload      - 上传单个文件到 S3
  batch-upload- 批量上传目录到 S3
  purge       - 清空 bucket 中所有文件（保留占位符）

示例:
  # 扫描全部
  python audit_s3.py --mode scan

  # 搜索含 "chrome" 的文件
  python audit_s3.py --mode search --keyword chrome

  # 下载所有含 "google" 的文件
  python audit_s3.py --mode download --keyword google -o ./downloads

  # 上传单个文件
  python audit_s3.py --mode upload --file ./mylogo.svg --key mylogo.svg

  # 批量上传整个目录
  python audit_s3.py --mode batch-upload --input-dir ./svgs/ --prefix brands/

  # 清空 bucket（保留 .emptyFolderPlaceholder）
  python audit_s3.py --mode purge --yes

  # 强制删除污染文件（无需确认）
  python audit_s3.py --mode delete --yes
        """,
    )
    parser.add_argument(
        "--mode",
        choices=["scan", "delete", "quarantine", "search", "download", "upload", "batch-upload", "purge"],
        default=MODE,
        help="操作模式 (默认从 .env 读取)",
    )
    parser.add_argument("--prefix", default="", help="只处理指定前缀下的对象")
    parser.add_argument("-k", "--keyword", default="", help="关键词过滤（支持 * 通配符，不区分大小写）")
    parser.add_argument("-o", "--output", default=DEFAULT_DOWNLOADS_DIR, help="下载输出目录（仅 download 模式）")
    parser.add_argument("--workers", type=int, default=8, help="并行线程数 (默认 8)")
    parser.add_argument("--out-dir", default=DEFAULT_REPORTS_DIR, help="报告输出目录（scan 模式）")
    parser.add_argument("--no-export", action="store_true", help="不导出 CSV/JSON 报告")
    parser.add_argument("--yes", action="store_true", help="跳过确认提示（delete/quarantine 模式）")
    parser.add_argument("--file", default="", help="要上传的本地文件路径（仅 upload 模式）")
    parser.add_argument("--key", default="", help="S3 目标 Key（仅 upload 模式，默认使用文件名）")
    parser.add_argument("--input-dir", default="", help="要批量上传的本地目录（仅 batch-upload 模式）")
    args = parser.parse_args()

    print(colored("=" * 60, "blue"))
    print(colored("Supabase S3 Storage 审计脚本", "blue", attrs=["bold"]))
    print(colored("=" * 60, "blue"))
    print(f"Endpoint:   {S3_ENDPOINT_URL}")
    print(f"Bucket:     {S3_BUCKET_NAME}")
    print(f"Region:     {S3_REGION}")
    print(f"Mode:       {args.mode}")
    if args.prefix:
        print(f"Prefix:     '{args.prefix}'")
    if args.keyword:
        print(f"Keyword:    '{args.keyword}'")
    if args.mode == "download":
        print(f"Output:     {os.path.abspath(args.output)}")
    if args.mode == "upload":
        print(f"File:       {args.file}")
        print(f"Key:        {args.key or os.path.basename(args.file)}")
    if args.mode == "batch-upload":
        print(f"Input Dir:  {os.path.abspath(args.input_dir)}")
        if args.prefix:
            print(f"S3 Prefix:  '{args.prefix}'")
    if args.yes:
        print(colored("Auto-confirm: YES", "yellow"))
    print(colored("=" * 60, "blue"))
    print()

    client = get_s3_client()

    # ========== search 模式 ==========
    if args.mode == "search":
        results = run_search(client, prefix=args.prefix, keyword=args.keyword, max_workers=args.workers)
        print_search_results(results)
        print()
        log_ok("搜索完成")
        return

    # ========== download 模式 ==========
    if args.mode == "download":
        run_download(client, prefix=args.prefix, keyword=args.keyword, output_dir=args.output, max_workers=args.workers)
        return

    # ========== upload 模式 ==========
    if args.mode == "upload":
        if not args.file:
            log_fatal("upload 模式需要 --file 参数")
        run_upload(client, args.file, key=args.key or None)
        return

    # ========== batch-upload 模式 ==========
    if args.mode == "batch-upload":
        if not args.input_dir:
            log_fatal("batch-upload 模式需要 --input-dir 参数")
        run_batch_upload(client, args.input_dir, prefix=args.prefix, max_workers=args.workers)
        return

    # ========== purge 模式 ==========
    if args.mode == "purge":
        run_purge(client, auto_confirm=args.yes)
        return

    # ========== scan / delete / quarantine 模式 ==========
    reports = scan_bucket(client, prefix=args.prefix, keyword=args.keyword, max_workers=args.workers)

    if not reports:
        sys.exit(0)

    print_summary(reports)
    print_dirty_table(reports)

    if not args.no_export:
        os.makedirs(args.out_dir, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_csv(reports, os.path.join(args.out_dir, f"audit_{ts}.csv"))
        export_json(reports, os.path.join(args.out_dir, f"audit_{ts}.json"))

    execute_actions(client, reports, args.mode, auto_confirm=args.yes)

    print()
    log_ok("脚本执行完毕")


if __name__ == "__main__":
    main()
